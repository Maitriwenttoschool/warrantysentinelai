import { useState } from "react";
import { ChevronRight, Download, Printer, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AuditStep } from "@/lib/warranty-engine";

export function AuditScreen({
  steps,
  onExport,
  onReset,
  claimId,
}: {
  steps: AuditStep[];
  onExport: () => void;
  onReset: () => void;
  claimId: string;
}) {
  const [open, setOpen] = useState<string[]>([]);
  const toggle = (id: string) => setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Auditable Decision Lineage &amp; Execution Trace</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Immutable execution record for claim <span className="font-mono text-foreground">{claimId}</span> · retained
            per F500 warranty governance policy WGP-14.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="size-4" /> Print / Save as PDF
          </Button>
          <Button variant="outline" onClick={onExport}>
            <Download className="size-4" /> Export Audit Package (JSON)
          </Button>
          <Button variant="navy" onClick={onReset}>
            <RotateCcw className="size-4" /> Process Next Claim
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-[var(--shadow-card)]">
        <ol className="relative space-y-1">
          {steps.map((step, i) => {
            const expanded = open.includes(step.id);
            const last = i === steps.length - 1;
            return (
              <li key={step.id} className="relative pl-11">
                {!last && (
                  <span
                    aria-hidden
                    className={`absolute left-[15px] top-8 bottom-0 w-px ${step.state === "complete" ? "bg-success/40" : "bg-border"}`}
                  />
                )}
                <span
                  className={`absolute left-0 top-1.5 flex size-8 items-center justify-center rounded-full border-2 font-mono text-[11px] font-bold ${
                    step.state === "complete"
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-dashed border-amber/50 bg-amber/10 text-amber"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="pb-5">
                  <button
                    type="button"
                    onClick={() => toggle(step.id)}
                    className="group flex w-full items-start justify-between gap-4 rounded-md px-3 py-2 text-left transition-colors hover:bg-secondary/60"
                  >
                    <span>
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{step.title}</span>
                        {step.state === "pending" && (
                          <span className="rounded-full border border-amber/30 bg-amber/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber">
                            PENDING
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">{step.subtitle}</span>
                      <span className="tabular mt-1 block font-mono text-[11px] text-muted-foreground/80">
                        {step.timestamp ? new Date(step.timestamp).toISOString().replace("T", " ").slice(0, 23) + "Z" : "—"}
                      </span>
                    </span>
                    <span className="flex items-center gap-1 pt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                      raw payload
                      <ChevronRight className={`size-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
                    </span>
                  </button>
                  {expanded && (
                    <pre className="mt-2 max-h-80 overflow-auto rounded-md border border-border bg-navy px-4 py-3 font-mono text-[11px] leading-relaxed text-navy-foreground/85">
                      {JSON.stringify(step.payload, null, 2)}
                    </pre>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
