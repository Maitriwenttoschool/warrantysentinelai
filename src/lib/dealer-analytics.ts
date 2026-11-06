import type { Analysis } from './warranty-engine';

export interface DealerClaim {
  dealer_id: string; claim_amount: number; risk_score: number | null; status: string;
  analysis_snapshot: unknown;
}
export function dealerMetrics(claims: DealerClaim[]) {
  const groups = new Map<string, { dealer: string; count: number; amount: number; riskTotal: number; scored: number; rejected: number; approved: number; inflation: number; anomalies: number }>();
  for (const claim of claims) {
    const group = groups.get(claim.dealer_id) ?? { dealer: claim.dealer_id, count: 0, amount: 0, riskTotal: 0, scored: 0, rejected: 0, approved: 0, inflation: 0, anomalies: 0 };
    group.count++; group.amount += Number(claim.claim_amount);
    if (claim.risk_score !== null) { group.riskTotal += claim.risk_score; group.scored++; }
    if (claim.status === 'REJECTED') group.rejected++;
    if (claim.status === 'APPROVED') group.approved++;
    const analysis = claim.analysis_snapshot as Analysis | null;
    if (analysis?.rules?.some(rule => rule.id === 'R-001' && rule.status === 'fail')) group.inflation++;
    if (analysis?.nlp?.anomaly_flag) group.anomalies++;
    groups.set(claim.dealer_id, group);
  }
  return [...groups.values()].map(g => ({ ...g, averageRisk: g.scored ? g.riskTotal / g.scored : null, rejectionRate: g.rejected / g.count * 100, approvalRate: g.approved / g.count * 100 }))
    .sort((a, b) => (b.averageRisk ?? -1) - (a.averageRisk ?? -1));
}