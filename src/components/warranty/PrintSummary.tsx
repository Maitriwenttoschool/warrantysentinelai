import type { Analysis, AuditStep, ClaimInput, HumanDecision } from "@/lib/warranty-engine";

const ts = (s?: string) => (s ? new Date(s).toISOString().replace("T", " ").slice(0, 19) + "Z" : "—");

export function PrintSummary({ claim, analysis, decision, steps }: {
  claim: ClaimInput; analysis: Analysis; decision: HumanDecision | null; steps: AuditStep[];
}) {
  return (
    <section className="hidden text-sm text-foreground print:block">
      <h1 className="text-xl font-bold">Warranty Claim Audit Summary — {claim.claim_id}</h1>
      <p className="mb-4 text-xs">Printed {ts(new Date().toISOString())}</p>
      <h2 className="mt-4 font-semibold">Claim details</h2>
      <table className="w-full"><tbody>
        {[["Serial", claim.serial_number], ["Dealer", claim.dealer_id], ["Repair", claim.repair_type],
          ["Amount", `$${claim.claim_amount.toLocaleString()}`], ["Labor hours", String(claim.labor_hours)]].map(([k, v]) => (
          <tr key={k}><td className="w-40 py-0.5 font-medium">{k}</td><td>{v}</td></tr>))}
      </tbody></table>
      <p className="mt-2 whitespace-pre-wrap">{claim.narrative}</p>
      <h2 className="mt-4 font-semibold">Rule results</h2>
      <ul>{analysis.rules.map(r => <li key={r.id}>[{r.status.toUpperCase()}] {r.label} — {r.detail}</li>)}</ul>
      <h2 className="mt-4 font-semibold">AI reasoning ({analysis.nlp.source})</h2>
      <p>Consistency {analysis.nlp.consistency} · Anomaly {analysis.nlp.anomaly_flag ? "Yes" : "No"} · Confidence {analysis.nlp.confidence}%</p>
      <p className="whitespace-pre-wrap">{analysis.nlp.reasoning}</p>
      <h2 className="mt-4 font-semibold">Risk & decision</h2>
      <p>Risk score {analysis.risk_score} · System decision {analysis.decision}</p>
      <p>Human decision: {decision ? `${decision.action} by ${decision.reviewer} at ${ts(decision.timestamp)} — ${decision.note}` : "Pending"}</p>
      <p>Claim status: {String([...steps].reverse().find(s => s.payload['final_state'])?.payload['final_state'] ?? 'AWAITING_REVIEW').replaceAll('_', ' ')}</p>
      {steps.filter(s => s.id === 'A8').map(s => <p key={s.id}>Independent signoff: {String(s.payload['action'])} by {String(s.payload['reviewer'])} at {ts(s.timestamp)} — {String(s.payload['note'])}</p>)}
      <h2 className="mt-4 font-semibold">Timeline</h2>
      <ol className="list-decimal pl-5">{steps.map(s => <li className="break-inside-avoid" key={s.id}>{ts(s.timestamp)} — {s.title}: {s.subtitle}</li>)}</ol>
    </section>
  );
}
