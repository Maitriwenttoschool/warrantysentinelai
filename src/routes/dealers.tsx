import { createFileRoute, Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ArrowLeft, RefreshCw, Download, Building2 } from 'lucide-react';
import { useReviewer } from '@/hooks/reviewer';
import { listClaims } from '@/lib/claim-storage';
import { dealerMetrics } from '@/lib/dealer-analytics';
import { DEALER_LEDGER } from '@/lib/warranty-engine';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export const Route = createFileRoute('/dealers')({
  head: () => ({ meta: [
    { title: 'Dealer Risk Analytics — Warranty Sentinel' },
    { name: 'description', content: 'Compare dealer claim volume, financial exposure, risk and decision trends in Warranty Sentinel.' },
    { property: 'og:title', content: 'Dealer Risk Analytics — Warranty Sentinel' },
    { property: 'og:description', content: 'Reviewer-scoped warranty claim metrics and dealer anomaly trends.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }), component: Dealers,
});
function Dealers() {
  const { user, ready } = useReviewer();
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const saved = useQuery({ queryKey: ['claims', user?.id], queryFn: listClaims, enabled: Boolean(user) });
  const claims = useMemo(() => (saved.data ?? []).filter(r => r.user_id === user?.id && (!from || r.created_at.slice(0, 10) >= from) && (!to || r.created_at.slice(0, 10) <= to)), [saved.data, user?.id, from, to]);
  const metrics = useMemo(() => dealerMetrics(claims).filter(r => `${r.dealer} ${DEALER_LEDGER[r.dealer]?.name ?? ''}`.toLowerCase().includes(search.toLowerCase())), [claims, search]);
  function download() {
    const headers = ['Dealer','Claims','Claim amount USD','Average risk','Rejection rate %','Approval rate %','Labor inflation','Anomalies'];
    const lines = metrics.map(m => [m.dealer,m.count,m.amount,m.averageRisk?.toFixed(1) ?? '',m.rejectionRate.toFixed(1),m.approvalRate.toFixed(1),m.inflation,m.anomalies]);
    const csv = [headers, ...lines].map(row => row.map(v => `"${String(v).replace(/^[=+@\-]/, "'$&").replaceAll('"', '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = 'dealer-risk-analytics.csv'; a.click(); URL.revokeObjectURL(url);
  }
  return <main className="mx-auto min-h-screen max-w-[1400px] px-6 py-8">
    <Button asChild variant="ghost" className="mb-6"><Link to="/"><ArrowLeft />Claims workspace</Link></Button>
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6"><div><p className="mb-2 text-sm font-semibold text-amber">Warranty Sentinel · Kensington Big Machines Company</p><h1 className="flex items-center gap-3 text-3xl font-semibold"><Building2 className="size-7" />Dealer risk analytics</h1></div>{user && <div className="flex gap-2"><Button variant="outline" aria-label="Refresh dealer analytics" disabled={saved.isFetching} onClick={() => void saved.refetch()}><RefreshCw className="size-4" /></Button><Button variant="navy" disabled={!metrics.length} onClick={download}><Download />Export CSV</Button></div>}</header>
    {!ready ? <p className="py-12 text-muted-foreground">Checking reviewer session…</p> : !user ? <div className="py-12"><Button asChild variant="navy"><Link to="/auth">Sign in to view dealer analytics</Link></Button></div> : saved.isPending ? <p className="py-12 text-muted-foreground">Loading dealer metrics…</p> : saved.isError ? <div role="alert" className="py-12 text-danger">Dealer metrics could not load.<Button variant="outline" className="ml-3" onClick={() => void saved.refetch()}>Retry</Button></div> : <>
      <div className="grid grid-cols-2 gap-6 border-b border-border py-6 lg:grid-cols-4">{[['Claims', claims.length], ['Dealers', dealerMetrics(claims).length], ['Claim exposure', `$${claims.reduce((s, c) => s + Number(c.claim_amount), 0).toLocaleString()}`], ['Awaiting second approval', claims.filter(c => c.status === 'AWAITING_SECOND_APPROVAL').length]].map(([label, value]) => <div key={label}><p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p><p className="mt-2 font-mono text-2xl font-bold">{value}</p></div>)}</div>
      <div className="flex flex-wrap items-end gap-4 py-6"><Input aria-label="Search dealers" placeholder="Search dealer" className="w-full sm:w-72" value={search} onChange={e => setSearch(e.target.value)} /><label className="text-xs font-semibold">From (UTC)<Input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label className="text-xs font-semibold">To (UTC)<Input type="date" min={from} value={to} onChange={e => setTo(e.target.value)} /></label><span className="text-xs text-muted-foreground">Your submitted claims · {metrics.length} dealers</span></div>
      {!metrics.length ? <p className="border-y border-border py-12 text-center text-muted-foreground">No saved claims match these filters.</p> : <div className="overflow-x-auto border-y border-border"><table className="w-full min-w-[860px] text-left text-sm"><thead className="bg-secondary text-xs uppercase text-muted-foreground"><tr>{['Dealer', 'Claims', 'Exposure', 'Avg. risk', 'Rejected', 'Approved', 'Labor inflation', 'Anomalies'].map(h => <th className="px-4 py-3" key={h}>{h}</th>)}</tr></thead><tbody className="divide-y divide-border">{metrics.map(m => <tr key={m.dealer}><td className="px-4 py-4"><p className="font-semibold">{m.dealer}</p><p className="text-xs text-muted-foreground">{DEALER_LEDGER[m.dealer]?.name ?? 'Unlisted dealer'}</p></td><td className="px-4 font-mono">{m.count}</td><td className="px-4 font-mono">${m.amount.toLocaleString()}</td><td className="px-4 font-mono">{m.averageRisk?.toFixed(1) ?? '—'}</td><td className="px-4 font-mono text-danger">{m.rejectionRate.toFixed(1)}%</td><td className="px-4 font-mono text-success">{m.approvalRate.toFixed(1)}%</td><td className="px-4 font-mono">{m.inflation}</td><td className="px-4 font-mono">{m.anomalies}</td></tr>)}</tbody></table></div>}
    </>}
  </main>;
}