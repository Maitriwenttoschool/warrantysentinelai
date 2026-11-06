import { describe, expect, it } from 'vitest';
import { runRules, SRTG_MAX_HOURS, SAMPLES } from '../src/lib/warranty-engine';
const byId = (r: ReturnType<typeof runRules>, id: string) => r.find(x => x.id === id)!;
describe('new deterministic rules', () => {
  it('fails unaccredited dealer', () => expect(byId(runRules({ ...SAMPLES.clean, dealer_id: 'DLR-XXX-000' }), 'R-005').status).toBe('fail'));
  it('warns on $10k+ claim without diagnostic evidence', () => expect(byId(runRules({ ...SAMPLES.clean, claim_amount: 10000, narrative: 'pump broke' }), 'R-006').status).toBe('warn'));
  it('attached log satisfies diagnostic evidence', () => expect(byId(runRules({ ...SAMPLES.clean, claim_amount: 10000, narrative: 'pump broke' }, ['telematics.csv']), 'R-006').status).toBe('pass'));
  it('uses configured SRTG matrix', () => expect(byId(runRules({ ...SAMPLES.clean, labor_hours: 5 }, [], { ...SRTG_MAX_HOURS, 'Seal Replacement': 6 }), 'R-001').status).toBe('pass'));
});
import { isDecisionNoteValid } from '../src/lib/warranty-engine';
describe('decision note rule', () => {
  it('reject needs a note', () => expect(isDecisionNoteValid('REJECTED', '')).toBe(false));
  it('investigate needs a note', () => expect(isDecisionNoteValid('INVESTIGATE', 'short')).toBe(false));
  it('approve needs no note', () => expect(isDecisionNoteValid('APPROVED', '')).toBe(true));
  it('reject with a reason passes', () => expect(isDecisionNoteValid('REJECTED', 'Serial mismatch with ledger')).toBe(true));
});
