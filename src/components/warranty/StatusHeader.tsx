import { Activity, Radio } from "lucide-react";
import type { ClaimInput } from "@/lib/warranty-engine";

const STEPS = [
  { id: 1, label: "Claim Intake" },
  { id: 2, label: "AI Analysis" },
  { id: 3, label: "Audit Trail" },
] as const;

function statusTone(status: string) {
  if (status.includes("APPROVED")) return "bg-success/15 text-success border-success/30";
  if (status.includes("REJECTED")) return "bg-danger/15 text-danger border-danger/30";
  if (status.includes("INVESTIG") || status.includes("REVIEW")) return "bg-amber/15 text-amber border-amber/30";
  return "bg-navy-foreground/10 text-navy-foreground border-navy-foreground/25";
}

export function StatusHeader({
  claim,
  status,
  timestamp,
  step,
  maxStep,
  onStep,
  endpointLabel,
}: {
  claim: ClaimInput;
  status: string;
  timestamp: string;
  step: number;
  maxStep: number;
  onStep: (s: number) => void;
  endpointLabel: string;
}) {
  const meta = [
    { label: "Claim ID", value: claim.claim_id || "—" },
    { label: "Serial Number", value: claim.serial_number || "—" },
    { label: "Dealer ID", value: claim.dealer_id || "—" },
    { label: "Timestamp (UTC)", value: timestamp ? new Date(timestamp).toISOString().replace("T", " ").slice(0, 19) : "—" },
  ];

  return (
    <header className="bg-navy text-navy-foreground">
      <div className="mx-auto max-w-[1400px] px-6 pt-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-md bg-amber text-amber-foreground">
              <Activity className="size-5" />
            </div>
            <div>
              <h1 className="font-mono text-base font-semibold tracking-tight">Warranty_NLP_Agent</h1>
              <p className="text-xs text-navy-foreground/60">
                Autonomous Supply Chain Orchestration · Heavy Equipment Warranty Division
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-md border border-navy-foreground/15 bg-navy-muted/50 px-3 py-1.5 font-mono text-[11px] text-navy-foreground/70 md:flex">
              <Radio className="size-3.5 text-amber" />
              {endpointLabel}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 border-t border-navy-foreground/10 py-4 md:grid-cols-5">
          {meta.map((m) => (
            <div key={m.label}>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-foreground/45">
                {m.label}
              </div>
              <div className="tabular mt-1 font-mono text-sm">{m.value}</div>
            </div>
          ))}
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-navy-foreground/45">Status</div>
            <span
              className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${statusTone(status)}`}
            >
              {status}
            </span>
          </div>
        </div>

        <nav className="flex gap-1">
          {STEPS.map((s) => {
            const active = s.id === step;
            const locked = s.id > maxStep;
            return (
              <button
                key={s.id}
                type="button"
                disabled={locked}
                onClick={() => onStep(s.id)}
                className={`-mb-px flex items-center gap-2 rounded-t-md border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "border-amber bg-background/10 text-navy-foreground"
                    : locked
                      ? "border-transparent text-navy-foreground/30"
                      : "border-transparent text-navy-foreground/65 hover:bg-navy-muted/60 hover:text-navy-foreground"
                }`}
              >
                <span
                  className={`flex size-5 items-center justify-center rounded-full font-mono text-[10px] ${
                    active ? "bg-amber text-amber-foreground" : "bg-navy-foreground/12 text-navy-foreground/70"
                  }`}
                >
                  {s.id}
                </span>
                {s.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
