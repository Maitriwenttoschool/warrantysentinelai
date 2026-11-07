import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Save, FolderOpen, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useReviewer } from '@/hooks/reviewer';
import { listClaims, type SavedClaim } from '@/lib/claim-storage';
import { ReviewerId } from './SecondApproval';

export function ReviewerBar({ onOpen, disabled }: { onOpen: (row: SavedClaim) => void; disabled: boolean }) {
  const { user, ready } = useReviewer();
  const navigate = useNavigate();
  const queries = useQueryClient();
  const [showClaims, setShowClaims] = useState(false);
  const [name, setName] = useState('');
  const profile = useQuery({ queryKey: ['profile', user?.id], enabled: Boolean(user), queryFn: async () => {
    const { data, error } = await supabase.from('profiles').select('display_name').single();
    if (error) throw error;
    return data;
  } });
  useEffect(() => { setName(profile.data?.display_name ?? ''); }, [profile.data]);
  const [statusF, setStatusF] = useState('ALL');
  const [q, setQ] = useState('');
  const [newest, setNewest] = useState(true);
  const saved = useQuery({ queryKey: ['claims', user?.id], queryFn: listClaims, enabled: Boolean(user) && showClaims });
  const rows = useMemo(() => (saved.data ?? [])
    .filter(r => statusF === 'ALL' || r.status === statusF)
    .filter(r => !q.trim() || `${r.dealer_id} ${r.claim_id} ${r.serial_number}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (newest ? -1 : 1) * a.created_at.localeCompare(b.created_at)), [saved.data, statusF, q, newest]);
  const statuses = useMemo(() => Array.from(new Set((saved.data ?? []).map(r => r.status))), [saved.data]);
  async function saveName() {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', user.id);
    if (error) toast.error('Reviewer name could not be saved');
    else { await queries.invalidateQueries({ queryKey: ['profile'] }); toast.success('Reviewer name saved'); }
  }
  async function signOut() {
    await queries.cancelQueries(); queries.clear();
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error('Sign-out failed'); return; }
    await navigate({ to: '/auth', replace: true });
  }
  return <section className="border-b border-border bg-card px-6 py-3">
    <div className="mx-auto flex max-w-[1352px] flex-wrap items-center gap-3">
      {!ready ? <span className="text-sm text-muted-foreground">Checking reviewer session…</span> : !user ? <>
        <span className="text-sm text-muted-foreground">Demo workspace</span>
        <Button size="sm" variant="navy" asChild><Link to="/auth">Sign in to analyze and save</Link></Button>
      </> : <>
        <label htmlFor="reviewer-name" className="text-xs font-semibold">Reviewer</label>
        <Input id="reviewer-name" className="w-52" value={name} placeholder="Display name" maxLength={100} onChange={e => setName(e.target.value)} />
        <Button variant="ghost" size="icon" title="Save reviewer name" aria-label="Save reviewer name" onClick={() => void saveName()}><Save /></Button>
        <Button size="sm" variant="outline" disabled={disabled} onClick={() => setShowClaims(v => !v)}><FolderOpen />Claims queue</Button>
        <Button size="sm" variant="outline" asChild disabled={disabled}><Link to="/dealers">Dealer analytics</Link></Button>
        <ReviewerId id={user.id} />
        <Button size="sm" variant="outline" asChild><Link to="/settings"><Settings />Settings</Link></Button>
        <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{user.email}</span>
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => void signOut()}><LogOut />Sign out</Button>
      </>}
    </div>
    {showClaims && user && <div className="mx-auto mt-4 max-w-[1352px] border-t border-border pt-3">
      {saved.isPending ? <p className="text-sm text-muted-foreground">Loading saved claims…</p> : saved.isError ? <div className="flex items-center gap-3"><p className="text-sm text-danger">Saved claims could not load.</p><Button size="sm" variant="outline" onClick={() => void saved.refetch()}>Retry</Button></div> : !saved.data?.length ? <p className="text-sm text-muted-foreground">No saved claims yet.</p> : <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <select aria-label="Filter by status" className="h-8 rounded-md border border-border bg-background px-2 text-sm" value={statusF} onChange={e => setStatusF(e.target.value)}>
            <option value="ALL">All statuses</option>{statuses.map(s => <option key={s} value={s}>{s.replaceAll('_', ' ')}</option>)}
          </select>
          <Input className="h-8 w-64" placeholder="Search dealer, claim or serial" value={q} onChange={e => setQ(e.target.value)} />
          <Button size="sm" variant="ghost" onClick={() => setNewest(v => !v)}>{newest ? 'Newest first' : 'Oldest first'}</Button>
          <span className="ml-auto text-xs text-muted-foreground">{rows.length} of {saved.data.length}</span>
        </div>
        <div className="max-h-72 overflow-auto divide-y divide-border">
        {rows.map(row => <div key={row.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
          <span className="font-mono font-semibold">{row.claim_id}</span><span>{row.serial_number}</span><span>{row.dealer_id}</span><span className="tabular">${Number(row.claim_amount).toLocaleString()}</span><span className="text-muted-foreground">Risk {row.risk_score ?? '—'}</span><span className="text-muted-foreground">{row.status.replaceAll('_', ' ')}</span><span className="text-xs text-muted-foreground">{new Date(row.created_at).toLocaleDateString()}</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => { onOpen(row); setShowClaims(false); }}>Open claim</Button>
        </div>)}
      </div></div>}
    </div>}
  </section>;
}