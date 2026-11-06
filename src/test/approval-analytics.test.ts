import { describe, expect, it } from 'vitest';
import { requiresSeniorApproval } from '@/lib/warranty-engine';
import { dealerMetrics } from '@/lib/dealer-analytics';
describe('independent approval gates', () => {
  it('requires second approval above $50,000', () => { expect(requiresSeniorApproval(50001, 0)).toBe(true); expect(requiresSeniorApproval(50000, 0)).toBe(false); });
  it('requires second approval for high risk starting at 60', () => { expect(requiresSeniorApproval(450, 60)).toBe(true); expect(requiresSeniorApproval(450, 59)).toBe(false); });
});
describe('dealer metrics', () => {
  it('counts only final approval, averages assessed risk, and groups anomaly and inflation flags', () => {
    const result = dealerMetrics([
      { dealer_id: 'DLR-TEX-044', claim_amount: 15000, risk_score: 80, status: 'REJECTED', analysis_snapshot: { rules: [{ id: 'R-001', status: 'fail' }], nlp: { anomaly_flag: true } } },
      { dealer_id: 'DLR-TEX-044', claim_amount: 450, risk_score: 0, status: 'APPROVED', analysis_snapshot: null },
      { dealer_id: 'DLR-TEX-044', claim_amount: 51000, risk_score: null, status: 'AWAITING_SECOND_APPROVAL', analysis_snapshot: null },
    ])[0];
    expect(result).toMatchObject({ count: 3, amount: 66450, averageRisk: 40, inflation: 1, anomalies: 1, approved: 1, rejected: 1 });
    expect(result?.rejectionRate).toBeCloseTo(100 / 3);
  });
  it('handles an empty claims history', () => expect(dealerMetrics([])).toEqual([]));
});