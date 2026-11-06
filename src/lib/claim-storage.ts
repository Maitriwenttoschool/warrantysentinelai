import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables } from '@/integrations/supabase/types';
import { buildAuditTrail, AI_MODEL, type Analysis, type AuditStep, type ClaimInput, type HumanDecision, type WebhookOutcome } from './warranty-engine';

export const asJson = (value: unknown): Json => JSON.parse(JSON.stringify(value)) as Json;
export type SavedClaim = Tables<'claims'>;

export async function saveAnalysis(claim: ClaimInput, analysis: Analysis, outcome: WebhookOutcome) {
  const trace = buildAuditTrail(claim, analysis, { url: AI_MODEL, outcome }, null);
  const { data, error } = await supabase.rpc('save_claim_analysis', {
    p_claim: asJson(claim), p_analysis: asJson(analysis), p_outcome: asJson(outcome), p_steps: asJson(trace),
  });
  if (error) throw error;
  return data;
}

export async function saveDecision(id: string, claim: ClaimInput, analysis: Analysis, outcome: WebhookOutcome | null, decision: HumanDecision) {
  const trace = buildAuditTrail(claim, analysis, { url: AI_MODEL, outcome }, decision);
  const step = trace.find(s => s.id === 'A6');
  if (!step) throw new Error('Decision trace unavailable');
  const { data, error } = await supabase.rpc('record_claim_decision', {
    p_id: id, p_action: decision.action, p_note: decision.note, p_step: asJson(step),
  });
  if (error) throw error;
  return data;
}

export async function listClaims() {
  const rows: SavedClaim[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('claims').select('*').order('created_at', { ascending: false }).order('id').range(offset, offset + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export async function readClaim(id: string) {
  const { data, error } = await supabase.from('claims').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function readTrace(id: string): Promise<AuditStep[]> {
  const { data, error } = await supabase.from('audit_events').select('payload').eq('claim_uuid', id).order('created_at');
  if (error) throw error;
  return data.map(row => row.payload as unknown as AuditStep);
}
export async function uploadEvidence(userId: string, claimUuid: string, files: File[]) {
  for (const f of files) {
    const safe = f.name.replace(/[^\w.\-]+/g, '_').slice(-120);
    const { error } = await supabase.storage.from('claim-evidence').upload(`${userId}/${claimUuid}/${Date.now()}-${safe}`, f);
    if (error) throw error;
  }
}

export async function listEvidence(userId: string, claimUuid: string) {
  const { data, error } = await supabase.storage.from('claim-evidence').list(`${userId}/${claimUuid}`);
  if (error) throw error;
  return data.map(o => ({ name: o.name, path: `${userId}/${claimUuid}/${o.name}` }));
}

export async function evidenceUrl(path: string) {
  const { data, error } = await supabase.storage.from('claim-evidence').createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}
