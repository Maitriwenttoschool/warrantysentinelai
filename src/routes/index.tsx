import { isDecisionNoteValid, requiresSeniorApproval } from "@/lib/warranty-engine";
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from '@tanstack/react-start';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useReviewer } from '@/hooks/reviewer';
import { ReviewerBar } from '@/components/warranty/ReviewerBar';
import { EvidenceFiles } from '@/components/warranty/EvidenceFiles';
import { saveAnalysis, saveDecision, readClaim, readTrace, uploadEvidence, type SavedClaim } from '@/lib/claim-storage';
import { SecondApproval } from '@/components/warranty/SecondApproval';
import { Button } from '@/components/ui/button';
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { StatusHeader } from "@/components/warranty/StatusHeader";
import { IntakeScreen } from "@/components/warranty/IntakeScreen";
import { AnalysisScreen } from "@/components/warranty/AnalysisScreen";
import { AuditScreen } from "@/components/warranty/AuditScreen";
import { PrintSummary } from "@/components/warranty/PrintSummary";
import { ANALYZE_STEPS, AnalyzingModal } from "@/components/warranty/AnalyzingModal";
import { analyzeClaimAi } from "@/lib/claim-ai.functions";
import {
  AI_MODEL,
  SAMPLES,
  buildAuditTrail,
  buildPayload,
  manualReviewNlp,
  runRules,
  scoreClaim,
  simulateNlp,
  type Analysis,
  type ClaimInput,
  type HumanDecision,
  type WebhookOutcome,
  type AuditStep,
} from "@/lib/warranty-engine";

const TITLE = "Warranty_NLP_Agent — Autonomous Warranty Claim Orchestration";
const DESC =
  "Enterprise warranty claim orchestration for heavy equipment: deterministic rule checks, AI narrative analysis, risk scoring, human-in-the-loop decisions and a full audit trail.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WarrantyAgent,
});

function preloaded(): { claim: ClaimInput; analysis: Analysis; outcome: WebhookOutcome } {
  const claim = SAMPLES.padding;
  const rules = runRules(claim);
  const nlp = simulateNlp(claim, rules);
  const { risk_score, decision } = scoreClaim(rules, nlp);
  return {
    claim,
    analysis: { rules, nlp, risk_score, decision, analyzed_at: "2026-09-06T14:41:07.000Z" },
    outcome: { ok: false, error: "Pre-loaded demo record — AI not invoked", model: AI_MODEL },
  };
}

function WarrantyAgent() {
  const { user } = useReviewer();
  const queries = useQueryClient();
  const analyzeAi = useServerFn(analyzeClaimAi);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedRow, setSavedRow] = useState<SavedClaim | null>(null);
  const [storedTrace, setStoredTrace] = useState<AuditStep[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const profile = useQuery({ queryKey: ['profile', user?.id], enabled: Boolean(user), queryFn: async () => {
    const { data, error } = await supabase.from('profiles').select('display_name').single();
    if (error) throw error;
    return data;
  } });
  const reviewer = profile.data?.display_name || user?.email || user?.id || 'Demo reviewer';
  const seed = useMemo(preloaded, []);
  const [claim, setClaim] = useState<ClaimInput>(seed.claim);
  const [analysis, setAnalysis] = useState<Analysis | null>(seed.analysis);
  const [outcome, setOutcome] = useState<WebhookOutcome | null>(seed.outcome);
  const [decision, setDecision] = useState<HumanDecision | null>(null);
  const [step, setStep] = useState(1);
  const [maxStep, setMaxStep] = useState(3);
  const [busyStep, setBusyStep] = useState<number | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  useEffect(() => {
    setSavedId(null); setSavedRow(null); setStoredTrace(null); setDecision(null); setSaveError(false);
    setClaim(seed.claim); setAnalysis(seed.analysis); setOutcome(seed.outcome); setStep(1);
  }, [user?.id, seed]);

  const status = savedRow?.status.replaceAll('_', ' ') ?? (decision
    ? decision.action === "APPROVED"
      ? "APPROVED"
      : decision.action === "REJECTED"
        ? "REJECTED"
        : "UNDER INVESTIGATION"
    : analysis
      ? analysis.decision === "PASS / AUTO-APPROVE"
        ? "AWAITING HITL · PASS"
        : analysis.decision === "REVIEW REQUIRED"
          ? "AWAITING HITL · REVIEW"
          : "AWAITING HITL · ESCALATED"
       : "DRAFT / INTAKE");

  const steps = storedTrace ?? (analysis
    ? buildAuditTrail(claim, analysis, { url: AI_MODEL, outcome }, decision)
    : []);

  const patch = (p: Partial<ClaimInput>) => setClaim((c) => ({ ...c, ...p }));

  async function analyze() {
    if (!user) { toast.info('Sign in to analyze and save claims'); return; }
    setSavedId(null); setSavedRow(null); setStoredTrace(null); setSaveError(false);
    setDecision(null);
    setBusyStep(0);
    const rules = runRules(claim, files.map(f => f.name));
    await wait(750);
    setBusyStep(1);
    await wait(700);
    setBusyStep(2);
    let result: { ok: boolean; status?: number; error?: string; nlp?: Analysis["nlp"]; model?: string };
    try {
      result = await analyzeAi({ data: buildPayload(claim) });
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : "AI request failed", model: AI_MODEL };
    }
    const nlp = result.ok && result.nlp ? result.nlp : manualReviewNlp(result.error ?? "unknown error");
    const scored = scoreClaim(rules, nlp);
    const risk_score = scored.risk_score;
    // AI failure never auto-approves: force at least manual review.
    const sysDecision = !result.ok && scored.decision === "PASS / AUTO-APPROVE" ? "REVIEW REQUIRED" : scored.decision;
    await wait(450);
    setOutcome(result);
    const next: Analysis = { rules, nlp, risk_score, decision: sysDecision, analyzed_at: new Date().toISOString() };
    setAnalysis(next);
    try {
      const id = await saveAnalysis(claim, next, result);
      setSavedId(id); setSavedRow(await readClaim(id)); setStoredTrace(await readTrace(id));
      if (files.length) { try { await uploadEvidence(user.id, id, files); setFiles([]); } catch { toast.error('Claim saved, but some evidence files failed to upload'); } }
      await queries.invalidateQueries({ queryKey: ['claims'] });
    } catch { setSaveError(true); toast.error('Analysis complete, but claim could not be saved. Retry saving before recording a decision.'); }
    setBusyStep(null);
    setMaxStep(3);
    setStep(2);
    if (result.ok) toast.success("AI analysis complete", { description: AI_MODEL });
    else toast.warning("AI analysis unavailable — claim routed to manual review", { description: result.error });
  }

  async function record(action: HumanDecision["action"], reason = "") {
    if (!user || !savedId || !analysis || saving) { toast.info('Analyze and save this claim before recording a decision'); return; }
    if (!isDecisionNoteValid(action, reason)) { toast.error('Please write a reason (at least 10 characters) to investigate or reject'); return; }
    setSaving(true);
    const d: HumanDecision = {
      action,
      reviewer,
      timestamp: new Date().toISOString(),
      note: reason || "Reviewer accepted system findings and authorized warranty payment.",
    };
    try {
      const timestamp = await saveDecision(savedId, claim, analysis, outcome, d);
      setDecision({ ...d, timestamp }); setSavedRow(await readClaim(savedId)); setStoredTrace(await readTrace(savedId));
      await queries.invalidateQueries({ queryKey: ['claims'] });
      toast.success(`Decision recorded: ${action}`, { description: `Claim ${claim.claim_id} · reviewer ${reviewer}` });
      setStep(3);
    } catch { toast.error('Decision could not be saved. Please retry.'); }
    finally { setSaving(false); }
  }

  async function retrySave() {
    if (!analysis || !outcome || saving) return;
    setSaving(true);
    try {
      const id = savedId ?? await saveAnalysis(claim, analysis, outcome);
      setSavedId(id); setSavedRow(await readClaim(id)); setStoredTrace(await readTrace(id)); setSaveError(false);
      if (user && files.length) { await uploadEvidence(user.id, id, files); setFiles([]); }
      await queries.invalidateQueries({ queryKey: ['claims'] }); toast.success('Claim saved');
    } catch { toast.error('Claim could not be saved. Please retry.'); }
    finally { setSaving(false); }
  }

  async function openSaved(row: SavedClaim) {
    if (!row.analysis_snapshot) { toast.error('This claim has no saved analysis'); return; }
    try {
      const trace = await readTrace(row.id);
      setClaim(row as ClaimInput); setAnalysis(row.analysis_snapshot as unknown as Analysis);
      setOutcome(row.ai_outcome as unknown as WebhookOutcome | null);
      const human = trace.find(s => s.id === 'A6');
      setDecision(human ? { action: human.payload['action'] as HumanDecision['action'], reviewer: String(human.payload['reviewer']), timestamp: human.timestamp, note: String(human.payload['note']) } : null);
      setSavedId(row.id); setSavedRow(row); setStoredTrace(trace); setSaveError(false); setFiles([]); setStep(2); setMaxStep(3);
    } catch { toast.error('Claim could not be opened. Please retry.'); }
  }

  function exportAudit() {
    const pkg = {
      export_version: "1.0",
      exported_at: new Date().toISOString(),
      claim: buildPayload(claim),
      analysis,
      human_decision: decision,
      integration: { ai_model: AI_MODEL, transport: analysis?.nlp.source, outcome },
      trace: steps,
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-${claim.claim_id || "claim"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Audit package exported");
  }

  function reset() {
    setSavedId(null); setSavedRow(null); setStoredTrace(null); setSaveError(false);
    setClaim({ ...SAMPLES.clean, claim_id: `CLM-${Math.floor(800000 + Math.random() * 99999)}`, narrative: "" });
    setAnalysis(null); setFiles([]);
    setOutcome(null);
    setDecision(null);
    setMaxStep(1);
    setStep(1);
    toast.info("Intake reset — ready for next claim");
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster />
      <div className="print:hidden">
      <StatusHeader
        claim={claim}
        status={status}
        timestamp={decision?.timestamp ?? analysis?.analyzed_at ?? ""}
        step={step}
        maxStep={analysis ? 3 : maxStep}
        onStep={setStep}
        endpointLabel={`AI · ${AI_MODEL}`}
      />

      <ReviewerBar key={user?.id ?? 'signed-out'} onOpen={row => void openSaved(row)} disabled={busyStep !== null || saving} />
      </div>

      <main className="mx-auto max-w-[1400px] px-6 py-8">
        {savedId && <p className="mb-4 text-xs font-semibold text-success print:hidden">{savedRow?.user_id === user?.id ? 'Saved to your reviewer account' : 'Assigned for your independent review'}</p>}
        {saveError && <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 text-sm text-danger">Claim not saved<Button variant="outline" size="sm" disabled={saving} onClick={() => void retrySave()}>Retry save</Button></div>}
        {step === 1 && (
          <IntakeScreen
            claim={claim}
            onChange={patch}
            onLoadSample={(k) => {
              setClaim(SAMPLES[k]);
              toast.info("Sample scenario loaded");
            }}
            onAnalyze={analyze}
            files={files}
            onFiles={setFiles}
          />
        )}
        {savedRow && user && step !== 1 && requiresSeniorApproval(Number(savedRow.claim_amount), savedRow.risk_score ?? 0) && <SecondApproval key={savedRow.id} row={savedRow} userId={user.id} onRefresh={async () => { await openSaved(await readClaim(savedRow.id)); await queries.invalidateQueries({ queryKey: ['claims'] }); }} />}
        {savedId && savedRow && user && step !== 1 && <EvidenceFiles key={savedId} userId={savedRow.user_id} claimUuid={savedId} />}
        {step === 2 &&
          (analysis ? (
            <AnalysisScreen key={savedId ?? claim.claim_id} claim={claim} analysis={analysis} onDecision={(action, note) => void record(action, note)} decided={Boolean(decision) || saving || !savedId || savedRow?.user_id !== user?.id} />
          ) : (
            <Empty message="No analysis yet — submit a claim from Intake." />
          ))}
        {step === 3 &&
          (analysis ? (
            <><div className="print:hidden"><AuditScreen steps={steps} onExport={exportAudit} onReset={reset} claimId={claim.claim_id} /></div>
            <PrintSummary claim={claim} analysis={analysis} decision={decision} steps={steps} /></>
          ) : (
            <Empty message="No execution trace yet — submit a claim from Intake." />
          ))}
      </main>

      {busyStep !== null && <AnalyzingModal activeStep={Math.min(busyStep, ANALYZE_STEPS.length - 1)} endpoint={`AI · ${AI_MODEL}`} />}
    </div>
  );
}

function Empty({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
