import { useState } from 'react';
import { ShieldCheck, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import type { SavedClaim } from '@/lib/claim-storage';
import { isDecisionNoteValid } from '@/lib/warranty-engine';
import { toast } from 'sonner';

export function SecondApproval({ row, userId, onRefresh }: { row: SavedClaim; userId: string; onRefresh: () => Promise<void> }) {
  const [reviewerId, setReviewerId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(action?: 'APPROVED' | 'INVESTIGATE' | 'REJECTED') {
    if (busy) return;
    setBusy(true);
    try {
      if (action) {
        if (!isDecisionNoteValid(action, note)) throw new Error('Write a decision reason first');
        const { error } = await supabase.rpc('record_second_decision', { p_id: row.id, p_action: action, p_note: note });
        if (error) throw error;
      } else {
        if (!/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(reviewerId.trim()) || reviewerId.trim() === userId) throw new Error('Enter a different registered reviewer’s ID');
        const { error } = await supabase.rpc('assign_second_reviewer', { p_id: row.id, p_reviewer: reviewerId.trim() });
        if (error) throw error;
      }
      await onRefresh(); toast.success(action ? 'Independent decision saved' : 'Second reviewer assigned');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Approval could not be saved. Check the reviewer ID and retry.'); }
    finally { setBusy(false); }
  }
  return <section className="mb-6 border-y border-amber/30 bg-amber/10 px-5 py-4 print:hidden">
    <h3 className="flex items-center gap-2 font-semibold"><ShieldCheck className="size-5 text-amber" />Senior approval required · independent reviewer signoff</h3>
    {row.second_decision ? <p className="mt-2 text-sm">Final independent decision: {row.second_decision} · {row.second_note || 'Approved'} · {row.second_decided_at}</p> : row.status !== 'AWAITING_SECOND_APPROVAL' ? <p className="mt-2 text-sm">Approval requires a second reviewer. Investigation and rejection do not require a second signoff.</p> : row.user_id === userId ? <>
      {row.second_reviewer_id ? <p className="mt-2 break-all text-sm">Awaiting signoff from reviewer {row.second_reviewer_id}</p> : <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex-1 text-xs font-semibold">Second reviewer ID<Input className="mt-1" aria-label="Second reviewer ID" value={reviewerId} onChange={e => setReviewerId(e.target.value)} placeholder="Registered reviewer ID" /></label>
        <Button variant="navy" disabled={busy || !reviewerId.trim()} onClick={() => void submit()}>Assign reviewer</Button>
      </div>}
    </> : <div className="mt-3 space-y-3">
      <textarea aria-label="Independent decision note" className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm" rows={2} value={note} onChange={e => setNote(e.target.value)} placeholder="Decision reason" disabled={busy} />
      <div className="flex flex-wrap gap-3"><Button variant="approve" disabled={busy} onClick={() => void submit('APPROVED')}>Second signoff · Approve</Button><Button variant="investigate" disabled={busy || !isDecisionNoteValid('INVESTIGATE', note)} onClick={() => void submit('INVESTIGATE')}>Investigate</Button><Button variant="reject" disabled={busy || !isDecisionNoteValid('REJECTED', note)} onClick={() => void submit('REJECTED')}>Reject</Button></div>
    </div>}
  </section>;
}

export function ReviewerId({ id }: { id: string }) {
  return <Button variant="ghost" size="sm" title="Copy reviewer ID for independent signoff" onClick={() => { void navigator.clipboard.writeText(id).then(() => toast.success('Reviewer ID copied')).catch(() => toast.error('Reviewer ID could not be copied')); }}><Copy className="size-4" />Copy reviewer ID</Button>;
}