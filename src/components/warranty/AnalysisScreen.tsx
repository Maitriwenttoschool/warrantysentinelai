import { AlertTriangle, BrainCircuit, CheckCircle2, CircleAlert, Cpu, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { isDecisionNoteValid, riskBand, type Analysis, type ClaimInput, type RuleResult } from "@/lib/warranty-engine";

const TONE = {
  success: { text: "text-success", bg: "bg-success/10", border: "border-success/30", stroke: "var(--success)" },
  warning: { text: "text-amber", bg: "bg-amber/10", border: "border-amber/30", stroke: "var(--amber)" },
  danger: { text: "text-danger", bg: "bg-danger/10", border: "border-danger/30", stroke: "var(--danger)" },
} as const;

function RiskGauge({ score }: { score: number }) {
  const band = riskBand(score);
  const tone = TONE[band.tone];
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-5">
      <div className="relative size-32">
        <svg viewBox="0 0 120 120" className="size-32 -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke={tone.stroke}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - (c * Math.min(score, 100)) / 100}
            className="transition-all duration-700"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`tabular font-mono text-3xl font-bold ${tone.text}`}>{score}</span>
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">/ 100</span>
        </div>
      </div>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Risk Score</div>
        <div className={`mt-1 inline-flex rounded-full border px-3 py-1 font-mono text-xs font-bold ${tone.bg} ${tone.text} ${tone.border}`}>
          {band.label} RISK
        </div>
        <ul className="mt-3 space-y-1 font-mono text-[11px] text-muted-foreground">
          <li>0–29 · Low / Auto-approve</li>
          <li>30–59 · Medium / Review</li>
          <li>60+ · High / Escalate</li>
        </ul>
      </div>
    </div>
  );
}

function RuleRow({ rule }: { rule: RuleResult }) {
  const Icon = rule.status === "pass" ? CheckCircle2 : rule.status === "warn" ? CircleAlert : AlertTriangle;
  const tone = rule.status === "pass" ? TONE.success : rule.status === "warn" ? TONE.warning : TONE.danger;
  return (
    <li className={`flex gap-3 rounded-md border px-4 py-3 ${tone.border} ${tone.bg}`}>
      <Icon className={`mt-0.5 size-5 shrink-0 ${tone.text}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">{rule.label}</span>
          <span className={`font-mono text-[10px] font-bold uppercase tracking-[0.12em] ${tone.text}`}>
            {rule.status === "pass" ? "PASS" : rule.status === "warn" ? "WARN" : "FAIL"}
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rule.detail}</p>
        <p className="mt-1.5 font-mono text-[10px] text-muted-foreground/80">
          {rule.id} · risk weight +{rule.weight}
        </p>
      </div>
    </li>
  );
}

export function AnalysisScreen({
  claim,
  analysis,
  onDecision,
  decided,
}: {
  claim: ClaimInput;
  analysis: Analysis;
  onDecision: (action: "APPROVED" | "INVESTIGATE" | "REJECTED", note: string) => void;
  decided: boolean;
}) {
  const [note, setNote] = useState("");
  const noteOk = isDecisionNoteValid("REJECTED", note);
  const decisionTone =
    analysis.decision === "PASS / AUTO-APPROVE"
      ? TONE.success
      : analysis.decision === "REVIEW REQUIRED"
        ? TONE.warning
        : TONE.danger;
  const nlpTone =
    analysis.nlp.consistency === "HIGH" ? TONE.success : analysis.nlp.consistency === "MEDIUM" ? TONE.warning : TONE.danger;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">AI Analysis &amp; Human Decision</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deterministic policy engine and NLP narrative analysis for claim{" "}
          <span className="font-mono text-foreground">{claim.claim_id}</span> · transport{" "}
          <span className="font-mono text-foreground">{analysis.nlp.source}</span>
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)] lg:col-span-2">
          <RiskGauge score={analysis.risk_score} />
        </div>
        <div className="flex flex-col justify-between rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              System Decision
            </div>
            <div
              className={`mt-3 inline-flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-sm font-bold ${decisionTone.bg} ${decisionTone.text} ${decisionTone.border}`}
            >
              <ShieldCheck className="size-4" />
              {analysis.decision}
            </div>
          </div>
          <dl className="mt-5 space-y-2 border-t border-border pt-4 text-xs">
            <Row label="Claim amount" value={`$${claim.claim_amount.toLocaleString()}`} />
            <Row label="Labor hours" value={`${claim.labor_hours} hrs`} />
            <Row label="Checks failed" value={`${analysis.rules.filter((r) => r.status !== "pass").length} of ${analysis.rules.length}`} />
          </dl>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <Cpu className="size-4 text-amber" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em]">Deterministic Findings</h3>
          </div>
          <ul className="space-y-3 p-5">
            {analysis.rules.map((r) => (
              <RuleRow key={r.id} rule={r} />
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <BrainCircuit className="size-4 text-amber" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em]">AI Narrative Explanation</h3>
          </div>
          <div className="space-y-5 p-5">
            <div className="grid grid-cols-3 gap-3">
              <Metric label="Consistency" value={analysis.nlp.consistency} tone={nlpTone} />
              <Metric
                label="Anomaly Flag"
                value={analysis.nlp.anomaly_flag ? "TRUE" : "FALSE"}
                tone={analysis.nlp.anomaly_flag ? TONE.danger : TONE.success}
              />
              <Metric label="Confidence" value={`${analysis.nlp.confidence}%`} tone={TONE.warning} />
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Detailed AI Reasoning
              </div>
              <p className="mt-2 text-sm leading-relaxed">{analysis.nlp.reasoning}</p>
            </div>
            {analysis.nlp.telematics_facts.length > 0 && (
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  IoT / Telematics Facts
                </div>
                <ul className="mt-2 space-y-1.5">
                  {analysis.nlp.telematics_facts.map((f) => (
                    <li key={f} className="flex gap-2 font-mono text-xs text-muted-foreground">
                      <span className="text-amber">▸</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-navy px-5 py-4 text-navy-foreground shadow-[var(--shadow-panel)]">
        <div className="w-full">
          <div className="text-sm font-semibold">Human-In-The-Loop Decision</div>
          <p className="text-xs text-navy-foreground/60">
            A written reason is required to investigate or reject · decisions are immutable once recorded
          </p>
          <textarea
            aria-label="Decision note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={decided}
            placeholder="Decision reason (required for Investigate / Reject)"
            className="mt-2 w-full rounded-md border border-navy-foreground/20 bg-transparent px-3 py-2 text-sm placeholder:text-navy-foreground/40"
            rows={2}
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="approve" onClick={() => onDecision("APPROVED", note.trim())} disabled={decided}>
            APPROVE CLAIM
          </Button>
          <Button variant="investigate" onClick={() => onDecision("INVESTIGATE", note.trim())} disabled={decided || !noteOk}>
            INVESTIGATE / RE-ROUTE
          </Button>
          <Button variant="reject" onClick={() => onDecision("REJECTED", note.trim())} disabled={decided || !noteOk}>
            REJECT CLAIM
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular font-mono font-medium">{value}</dd>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: (typeof TONE)[keyof typeof TONE] }) {
  return (
    <div className={`rounded-md border px-3 py-2.5 ${tone.border} ${tone.bg}`}>
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={`tabular mt-1 font-mono text-sm font-bold ${tone.text}`}>{value}</div>
    </div>
  );
}
