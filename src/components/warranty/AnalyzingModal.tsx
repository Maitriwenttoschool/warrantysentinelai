import { Check, Loader2 } from "lucide-react";

export const ANALYZE_STEPS = [
  "Validating Serial...",
  "Checking SRTG Labor Guidelines...",
  "Invoking AI NLP Engine...",
] as const;

export function AnalyzingModal({ activeStep, endpoint }: { activeStep: number; endpoint: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/70 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-7 shadow-[var(--shadow-panel)]">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 animate-spin text-amber" />
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em]">Orchestrating Claim Analysis</h3>
            <p className="font-mono text-[11px] text-muted-foreground">{endpoint}</p>
          </div>
        </div>
        <ul className="mt-6 space-y-3">
          {ANALYZE_STEPS.map((label, i) => {
            const done = i < activeStep;
            const active = i === activeStep;
            return (
              <li key={label} className="flex items-center gap-3">
                <span
                  className={`flex size-6 items-center justify-center rounded-full border ${
                    done
                      ? "border-success/40 bg-success/10 text-success"
                      : active
                        ? "border-amber/40 bg-amber/10 text-amber"
                        : "border-border bg-muted text-muted-foreground"
                  }`}
                >
                  {done ? <Check className="size-3.5" /> : active ? <Loader2 className="size-3.5 animate-spin" /> : null}
                </span>
                <span
                  className={`font-mono text-xs ${done ? "text-muted-foreground line-through" : active ? "font-semibold text-foreground" : "text-muted-foreground/60"}`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
