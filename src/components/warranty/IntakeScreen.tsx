import { useEffect, useState } from "react";
import { FileText, Gauge, Paperclip, Sparkles, Wrench, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  REPAIR_TYPES,
  SAMPLES,
  getSrtg,
  setSrtg,
  type ClaimInput,
  type RepairType,
} from "@/lib/warranty-engine";

const SAMPLE_BUTTONS: { key: keyof typeof SAMPLES; label: string; hint: string }[] = [
  { key: "padding", label: "Load Claim Padding Sample", hint: "18 hrs · $15,000 · engine overhaul, coolant alarms ignored" },
  { key: "fraud", label: "Load Serial Fraud Sample", hint: "Hydraulic pump · grey-market serial mismatch" },
  { key: "clean", label: "Load Clean Claim Sample", hint: "3 hrs · $450 · seal replacement" },
];

export function IntakeScreen({
  claim,
  onChange,
  onLoadSample,
  onAnalyze,
  files,
  onFiles,
}: {
  files: File[];
  onFiles: (f: File[]) => void;
  claim: ClaimInput;
  onChange: (patch: Partial<ClaimInput>) => void;
  onLoadSample: (key: keyof typeof SAMPLES) => void;
  onAnalyze: () => void;
}) {
  const [matrix, setMatrix] = useState<Record<RepairType, number> | null>(null);
  const [editSrtg, setEditSrtg] = useState(false);
  useEffect(() => setMatrix(getSrtg()), []);
  const srtg = matrix?.[claim.repair_type] ?? 0;
  const ready = claim.claim_id && claim.serial_number && claim.dealer_id && claim.narrative.length > 20;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Warranty Claim Intake &amp; System Pre-Check</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Structured claim fields are validated against the dealer master ledger; the narrative is analyzed by the built-in AI
          engine for consistency.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <Wrench className="size-4 text-amber" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em]">Structured Claim Fields</h3>
          </div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Claim ID">
              <Input
                value={claim.claim_id}
                onChange={(e) => onChange({ claim_id: e.target.value })}
                placeholder="CLM-884920"
                className="font-mono"
              />
            </Field>
            <Field label="Serial Number">
              <Input
                value={claim.serial_number}
                onChange={(e) => onChange({ serial_number: e.target.value.toUpperCase() })}
                placeholder="CAT-797F-99281"
                className="font-mono"
              />
            </Field>
            <Field label="Dealer ID">
              <Input
                value={claim.dealer_id}
                onChange={(e) => onChange({ dealer_id: e.target.value.toUpperCase() })}
                placeholder="DLR-TEX-044"
                className="font-mono"
              />
            </Field>
            <Field label="Repair Type / Code">
              <Select
                value={claim.repair_type}
                onValueChange={(v) => onChange({ repair_type: v as RepairType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPAIR_TYPES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Claim Amount (USD)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-muted-foreground">$</span>
                <Input
                  type="number"
                  min={0}
                  value={claim.claim_amount || ""}
                  onChange={(e) => onChange({ claim_amount: Number(e.target.value) })}
                  placeholder="15000"
                  className="tabular pl-7 font-mono"
                />
              </div>
            </Field>
            <Field label="Labor Hours Claimed">
              <Input
                type="number"
                min={0}
                step="0.5"
                value={claim.labor_hours || ""}
                onChange={(e) => onChange({ labor_hours: Number(e.target.value) })}
                placeholder="18"
                className="tabular font-mono"
              />
            </Field>
          </div>
          <div className="flex items-center gap-2 border-t border-border bg-muted/60 px-5 py-3 text-xs text-muted-foreground">
            <Gauge className="size-3.5 text-amber" />
            SRTG published maximum for <span className="font-medium text-foreground">{claim.repair_type}</span> is
            <span className="tabular font-mono font-semibold text-foreground">{srtg} hrs</span>
          </div>
        </section>

        <section className="flex flex-col rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3.5">
            <FileText className="size-4 text-amber" />
            <h3 className="text-sm font-semibold uppercase tracking-[0.1em]">Unstructured Failure Narrative</h3>
          </div>
          <div className="flex flex-1 flex-col gap-4 p-5">
            <Field label="Failure Narrative">
              <Textarea
                value={claim.narrative}
                onChange={(e) => onChange({ narrative: e.target.value })}
                placeholder="Describe the operator's account, telematics notes, and work order details..."
                className="min-h-[220px] resize-y leading-relaxed"
              />
            </Field>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Fast sample scenarios
              </div>
              <div className="mt-2 grid gap-2">
                {SAMPLE_BUTTONS.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => onLoadSample(s.key)}
                    className="group flex items-start gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-left transition-colors hover:border-amber/50 hover:bg-amber/5"
                  >
                    <Sparkles className="mt-0.5 size-4 shrink-0 text-amber" />
                    <span>
                      <span className="block text-sm font-medium">{s.label}</span>
                      <span className="block text-xs text-muted-foreground">{s.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-center gap-3">
          <Paperclip className="size-4 text-amber" />
          <h3 className="text-sm font-semibold uppercase tracking-[0.1em]">Evidence Attachments</h3>
          <span className="text-xs text-muted-foreground">Work order, invoice, diagnostic / telematics log · 20 MB max each</span>
          <label className="ml-auto cursor-pointer rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-secondary">
            Add files
            <input type="file" multiple className="sr-only" accept=".pdf,.png,.jpg,.jpeg,.csv,.txt,.log,.json"
              onChange={(e) => { const add = Array.from(e.target.files ?? []).filter((f) => f.size <= 20 * 1024 * 1024); onFiles([...files, ...add]); e.target.value = ""; }} />
          </label>
          <Button variant="outline" size="sm" onClick={() => setEditSrtg((v) => !v)}>SRTG labor matrix</Button>
        </div>
        {files.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{files.map((f, i) => (
          <li key={f.name + i} className="flex items-center gap-1 rounded border border-border bg-secondary/40 px-2 py-1 text-xs">
            {f.name}<button type="button" aria-label={`Remove ${f.name}`} onClick={() => onFiles(files.filter((_, j) => j !== i))}><X className="size-3" /></button>
          </li>))}</ul>}
        {editSrtg && matrix && <div className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-4">
          {REPAIR_TYPES.map((t) => <Field key={t} label={`${t} (max hrs)`}>
            <Input type="number" min={0.5} step={0.5} value={matrix[t]} onChange={(e) => setMatrix({ ...matrix, [t]: Number(e.target.value) })} />
          </Field>)}
          <div className="flex gap-2 sm:col-span-4">
            <Button size="sm" variant="navy" onClick={() => { setSrtg(matrix); toast.success("SRTG matrix saved"); }}>Save matrix</Button>
            <Button size="sm" variant="ghost" onClick={() => { setSrtg(null); setMatrix(getSrtg()); toast.info("SRTG matrix reset to defaults"); }}>Reset defaults</Button>
          </div>
        </div>}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-card px-5 py-4 shadow-[var(--shadow-card)]">
        <p className="max-w-xl text-xs text-muted-foreground">
          Analysis runs deterministic rules and a secure server-side AI narrative review. If the AI is unavailable, no
          verdict is simulated — the claim is routed to manual review and the failure is recorded in the audit trail.
        </p>
        <Button variant="industrial" size="lg" disabled={!ready} onClick={onAnalyze} className="min-w-56">
          ANALYZE CLAIM
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
