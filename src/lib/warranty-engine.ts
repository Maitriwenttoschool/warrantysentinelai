export type RepairType =
  | "Engine Overhaul"
  | "Hydraulic Pump Replacement"
  | "Seal Replacement"
  | "Transmission Service";

export const REPAIR_TYPES: RepairType[] = [
  "Engine Overhaul",
  "Hydraulic Pump Replacement",
  "Seal Replacement",
  "Transmission Service",
];

export const SRTG_MAX_HOURS: Record<RepairType, number> = {
  "Engine Overhaul": 12,
  "Hydraulic Pump Replacement": 6,
  "Seal Replacement": 4,
  "Transmission Service": 8,
};

const SRTG_KEY = "srtg-matrix";
/** Reviewer-configured SRTG matrix (browser-local), falling back to defaults. */
export function getSrtg(): Record<RepairType, number> {
  if (typeof window === "undefined") return SRTG_MAX_HOURS;
  try {
    const saved = JSON.parse(localStorage.getItem(SRTG_KEY) ?? "{}") as Partial<Record<RepairType, number>>;
    const out = { ...SRTG_MAX_HOURS };
    for (const t of REPAIR_TYPES) if (typeof saved[t] === "number" && saved[t]! > 0) out[t] = saved[t]!;
    return out;
  } catch { return SRTG_MAX_HOURS; }
}
export function setSrtg(m: Record<RepairType, number> | null) {
  if (m) localStorage.setItem(SRTG_KEY, JSON.stringify(m)); else localStorage.removeItem(SRTG_KEY);
}

export const HIGH_VALUE_THRESHOLD = 250_000;
export const SENIOR_APPROVAL_THRESHOLD = 50_000;
export function requiresSeniorApproval(amount: number, risk: number) {
  return amount > SENIOR_APPROVAL_THRESHOLD || risk >= 60;
}
/** Claims at or above this amount must carry diagnostic evidence. */
export const DIAGNOSTIC_EVIDENCE_THRESHOLD = 10_000;

export interface ClaimInput {
  claim_id: string;
  serial_number: string;
  dealer_id: string;
  repair_type: RepairType;
  labor_hours: number;
  claim_amount: number;
  narrative: string;
}

export interface RuleResult {
  id: string;
  label: string;
  detail: string;
  status: "pass" | "fail" | "warn";
  weight: number;
  evidence: Record<string, unknown>;
}

export interface NlpResult {
  consistency: "HIGH" | "MEDIUM" | "LOW";
  anomaly_flag: boolean;
  reasoning: string;
  confidence: number;
  telematics_facts: string[];
  source: "ai" | "manual-review" | "demo";
}

export type SystemDecision =
  | "PASS / AUTO-APPROVE"
  | "REVIEW REQUIRED"
  | "HIGH RISK / ESCALATE";

export interface AuditStep {
  id: string;
  title: string;
  subtitle: string;
  timestamp: string;
  state: "complete" | "pending";
  payload: Record<string, unknown>;
}

export interface HumanDecision {
  action: "APPROVED" | "INVESTIGATE" | "REJECTED";
  reviewer: string;
  timestamp: string;
  note: string;
}

export interface Analysis {
  rules: RuleResult[];
  nlp: NlpResult;
  risk_score: number;
  decision: SystemDecision;
  analyzed_at: string;
}

/* ---------- Mock master ledger ---------- */

export const SERIAL_LEDGER: Record<
  string,
  { model: string; warranty: "ACTIVE" | "EXPIRED"; expires: string; origin: string }
> = {
  "CAT-797F-99281": {
    model: "797F Mining Truck",
    warranty: "ACTIVE",
    expires: "2027-04-30",
    origin: "Factory / Decatur IL",
  },
  "CAT-336-11204": {
    model: "336 Hydraulic Excavator",
    warranty: "ACTIVE",
    expires: "2026-11-12",
    origin: "Factory / Akashi JP",
  },
  "CAT-D8T-55110": {
    model: "D8T Track Dozer",
    warranty: "EXPIRED",
    expires: "2025-02-01",
    origin: "Factory / East Peoria IL",
  },
};

export const DEALER_LEDGER: Record<string, { name: string; region: string; tier: string }> = {
  "DLR-TEX-044": { name: "Lone Star Heavy Equipment", region: "US-SOUTHWEST", tier: "GOLD" },
  "DLR-ALB-019": { name: "Northern Basin Machinery", region: "CA-WEST", tier: "SILVER" },
};

export const PRIOR_CLAIMS = [
  { claim_id: "CLM-871402", serial_number: "CAT-797F-99281", repair_type: "Engine Overhaul", days_ago: 41 },
  { claim_id: "CLM-869915", serial_number: "CAT-336-11204", repair_type: "Seal Replacement", days_ago: 212 },
];

/* ---------- Sample scenarios ---------- */

export const SAMPLES: Record<"padding" | "fraud" | "clean", ClaimInput> = {
  padding: {
    claim_id: "CLM-884920",
    serial_number: "CAT-797F-99281",
    dealer_id: "DLR-TEX-044",
    repair_type: "Engine Overhaul",
    labor_hours: 18,
    claim_amount: 15000,
    narrative:
      "Operator reports engine seized without warning during haul cycle on bench 4. Work order lists full top-end overhaul, 18 hours of labor across two technicians. Telematics history shows repeated low coolant level warnings for 9 consecutive shifts prior to failure; unit was not parked. No pre-failure inspection recorded by the dealer.",
  },
  fraud: {
    claim_id: "CLM-884921",
    serial_number: "CAT-797X-00007",
    dealer_id: "DLR-ALB-019",
    repair_type: "Hydraulic Pump Replacement",
    labor_hours: 7,
    claim_amount: 42800,
    narrative:
      "Hydraulic pump replaced after complete loss of implement pressure. Serial plate on the machine does not match the ECM-reported serial; unit appears to be a grey-market import re-badged by a third party. Dealer submitted photos with a decal-only serial tag and no factory build record.",
  },
  clean: {
    claim_id: "CLM-884922",
    serial_number: "CAT-336-11204",
    dealer_id: "DLR-TEX-044",
    repair_type: "Seal Replacement",
    labor_hours: 3,
    claim_amount: 450,
    narrative:
      "Minor hydraulic weep observed at the boom cylinder rod seal during scheduled 500-hour service. Seal kit replaced, 3 hours labor. Telematics show no pressure anomalies and consistent duty cycle. Failure narrative matches technician notes and parts consumed.",
  },
};

export const EMPTY_CLAIM: ClaimInput = {
  claim_id: "",
  serial_number: "",
  dealer_id: "",
  repair_type: "Engine Overhaul",
  labor_hours: 0,
  claim_amount: 0,
  narrative: "",
};

/* ---------- Deterministic rules ---------- */

export function runRules(claim: ClaimInput, evidence: string[] = [], srtg: Record<RepairType, number> = getSrtg()): RuleResult[] {
  const srtgMax = srtg[claim.repair_type];
  const dealer = DEALER_LEDGER[claim.dealer_id.trim().toUpperCase()];
  const accredited = dealer && dealer.tier !== "PROBATION";
  const faultCode = /\b(fault code|fmi|spn|cid|ecm|telematics|diagnostic)\b/i.test(claim.narrative);
  const hasLog = evidence.some((n) => /log|diag|telem|csv/i.test(n));
  const needsDiag = claim.claim_amount >= DIAGNOSTIC_EVIDENCE_THRESHOLD;
  const diagOk = !needsDiag || faultCode || hasLog;
  const overHours = Number((claim.labor_hours - srtgMax).toFixed(1));
  const laborFail = claim.labor_hours > srtgMax;

  const serial = SERIAL_LEDGER[claim.serial_number.trim().toUpperCase()];
  const serialStatus: RuleResult["status"] = !serial ? "fail" : serial.warranty === "ACTIVE" ? "pass" : "warn";

  const dup = PRIOR_CLAIMS.find(
    (p) =>
      p.serial_number === claim.serial_number.trim().toUpperCase() &&
      p.repair_type === claim.repair_type &&
      p.days_ago < 90,
  );

  const highValue = claim.claim_amount > HIGH_VALUE_THRESHOLD;

  return [
    {
      id: "R-001",
      label: "Labor Inflation Check",
      detail: laborFail
        ? `Claimed ${claim.labor_hours} hrs exceeds SRTG max of ${srtgMax} hrs (+${overHours} hrs)`
        : `Claimed ${claim.labor_hours} hrs within SRTG max of ${srtgMax} hrs`,
      status: laborFail ? "fail" : "pass",
      weight: laborFail ? Math.min(40, Math.round((overHours / srtgMax) * 45)) : 0,
      evidence: { rule: "labor_hours <= srtg_max", srtg_max_hours: srtgMax, claimed_hours: claim.labor_hours, delta: overHours },
    },
    {
      id: "R-002",
      label: "Serial Warranty Eligibility",
      detail: !serial
        ? `Serial ${claim.serial_number || "(blank)"} not found in factory master ledger — possible grey-market unit`
        : serial.warranty === "ACTIVE"
          ? `${serial.model} — warranty ACTIVE through ${serial.expires}`
          : `${serial.model} — warranty EXPIRED ${serial.expires}`,
      status: serialStatus,
      weight: !serial ? 45 : serial.warranty === "EXPIRED" ? 25 : 0,
      evidence: {
        rule: "serial in master_ledger AND warranty == ACTIVE",
        serial_number: claim.serial_number,
        ledger_match: serial ?? null,
      },
    },
    {
      id: "R-003",
      label: "Duplicate Claim Detection",
      detail: dup
        ? `Matching repair on same serial ${dup.days_ago} days ago (${dup.claim_id})`
        : "No matching repair on this serial within 90-day window",
      status: dup ? "fail" : "pass",
      weight: dup ? 20 : 0,
      evidence: { rule: "no same serial + repair_type within 90 days", window_days: 90, match: dup ?? null },
    },
    {
      id: "R-004",
      label: "High-Value Policy Gate",
      detail: highValue
        ? `Claim amount $${claim.claim_amount.toLocaleString()} exceeds $${HIGH_VALUE_THRESHOLD.toLocaleString()} — mandatory escalation`
        : `Claim amount $${claim.claim_amount.toLocaleString()} below $${HIGH_VALUE_THRESHOLD.toLocaleString()} gate`,
      status: highValue ? "fail" : "pass",
      weight: highValue ? 30 : 0,
      evidence: { rule: "claim_amount <= 250000", threshold: HIGH_VALUE_THRESHOLD, claim_amount: claim.claim_amount },
    },
    {
      id: "R-005",
      label: "Dealer Accreditation Gate",
      detail: accredited
        ? `${dealer.name} — accredited ${dealer.tier} dealer (${dealer.region})`
        : `Dealer ${claim.dealer_id || "(blank)"} is not an accredited dealer in the master ledger`,
      status: accredited ? "pass" : "fail",
      weight: accredited ? 0 : 20,
      evidence: { rule: "dealer_id in dealer_ledger AND tier != PROBATION", dealer_id: claim.dealer_id, ledger_match: dealer ?? null },
    },
    {
      id: "R-006",
      label: "Mandatory Diagnostic Evidence",
      detail: !needsDiag
        ? `Below $${DIAGNOSTIC_EVIDENCE_THRESHOLD.toLocaleString()} — diagnostic evidence optional`
        : diagOk
          ? `Diagnostic evidence present (${hasLog ? "log attached" : "fault code in narrative"})`
          : `Claims ≥ $${DIAGNOSTIC_EVIDENCE_THRESHOLD.toLocaleString()} need a fault code or attached diagnostic/telematics log`,
      status: diagOk ? "pass" : "warn",
      weight: diagOk ? 0 : 10,
      evidence: { rule: "claim_amount < 10000 OR fault_code OR diagnostic_log", threshold: DIAGNOSTIC_EVIDENCE_THRESHOLD, fault_code_in_narrative: faultCode, attachments: evidence },
    },
  ];
}

/* ---------- Demo NLP (pre-loaded sample record only) ---------- */

export function simulateNlp(claim: ClaimInput, rules: RuleResult[]): NlpResult {
  const text = claim.narrative.toLowerCase();
  const facts: string[] = [];
  let consistency: NlpResult["consistency"] = "HIGH";
  let anomaly = false;
  let reasoning =
    "Operator account, technician notes, and telematics signatures are mutually consistent. Parts consumed and labor duration align with the reported failure mode. No indicators of narrative shaping or claim engineering detected.";

  if (/coolant|overheat|temperature/.test(text) && /seiz|failure|catastroph/.test(text)) {
    consistency = "LOW";
    anomaly = true;
    facts.push("9 consecutive shifts of low-coolant warnings prior to failure event");
    facts.push("No operator shutdown recorded despite active alarm state");
    reasoning =
      "The narrative frames the failure as sudden and without warning, but telematics contradict this: low coolant warnings were active for nine consecutive shifts and the machine continued to operate at full duty cycle. This reframes the event from a covered component defect toward operator neglect. Labor duration also exceeds published SRTG guidance for this repair, consistent with hour padding across two technicians.";
  } else if (/grey-market|grey market|mismatch|re-badg|rebadg|decal/.test(text)) {
    consistency = "LOW";
    anomaly = true;
    facts.push("Serial plate value differs from ECM-reported serial");
    facts.push("No factory build record for submitted serial");
    reasoning =
      "Narrative itself discloses a serial identity conflict: the physical serial plate does not match the ECM-reported serial and no factory build record exists. This is a strong grey-market / warranty-ineligibility signal. Repair description is technically plausible, but entitlement cannot be established for this unit.";
  } else if (rules.some((r) => r.status !== "pass")) {
    consistency = "MEDIUM";
    anomaly = true;
    facts.push("Deterministic rule exceptions present alongside otherwise plausible narrative");
    reasoning =
      "The failure narrative is technically plausible and internally consistent, but one or more deterministic policy checks flagged. Recommend targeted verification of the flagged dimension before disposition.";
  } else {
    facts.push("No pressure or temperature anomalies in the 200 hours preceding the repair");
    facts.push("Duty cycle consistent with fleet baseline");
  }

  const base = consistency === "HIGH" ? 94 : consistency === "MEDIUM" ? 86 : 88;
  return {
    consistency,
    anomaly_flag: anomaly,
    reasoning,
    confidence: base + (claim.narrative.length % 5),
    telematics_facts: facts,
    source: "demo",
  };
}

/* ---------- Scoring ---------- */

export function scoreClaim(rules: RuleResult[], nlp: NlpResult): { risk_score: number; decision: SystemDecision } {
  let score = rules.reduce((sum, r) => sum + r.weight, 0);
  if (nlp.consistency === "LOW") score += 20;
  else if (nlp.consistency === "MEDIUM") score += 10;
  if (nlp.anomaly_flag) score += 5;
  const risk_score = Math.max(0, Math.min(100, score));
  const decision: SystemDecision =
    risk_score >= 60 ? "HIGH RISK / ESCALATE" : risk_score >= 30 ? "REVIEW REQUIRED" : "PASS / AUTO-APPROVE";
  return { risk_score, decision };
}

export function riskBand(score: number): { label: string; tone: "success" | "warning" | "danger" } {
  if (score >= 60) return { label: "HIGH", tone: "danger" };
  if (score >= 30) return { label: "MEDIUM", tone: "warning" };
  return { label: "LOW", tone: "success" };
}

/* ---------- AI analysis ---------- */

export const AI_MODEL = "openai/gpt-5-mini";

export function buildPayload(claim: ClaimInput) {
  return {
    claim_id: claim.claim_id,
    serial_number: claim.serial_number,
    dealer_id: claim.dealer_id,
    repair_type: claim.repair_type,
    labor_hours: claim.labor_hours,
    claim_amount: claim.claim_amount,
    narrative: claim.narrative,
  };
}

export interface WebhookOutcome {
  ok: boolean;
  status?: number;
  error?: string;
  model?: string;
}

/** Used when AI analysis fails: no simulated verdict, claim is routed to manual review. */
export function manualReviewNlp(error: string): NlpResult {
  return {
    consistency: "MEDIUM",
    anomaly_flag: true,
    reasoning: `AI narrative analysis unavailable (${error}). No automated narrative verdict was produced — this claim requires manual review.`,
    confidence: 0,
    telematics_facts: [],
    source: "manual-review",
  };
}

/* ---------- Audit trail ---------- */

export function buildAuditTrail(
  claim: ClaimInput,
  analysis: Analysis,
  webhook: { url: string; outcome: WebhookOutcome | null },
  decision: HumanDecision | null,
): AuditStep[] {
  const t = (offsetMs: number) => new Date(new Date(analysis.analyzed_at).getTime() + offsetMs).toISOString();
  const serial = SERIAL_LEDGER[claim.serial_number.trim().toUpperCase()] ?? null;
  const dealer = DEALER_LEDGER[claim.dealer_id.trim().toUpperCase()] ?? null;

  const steps: AuditStep[] = [
    {
      id: "A1",
      title: "Claim Received",
      subtitle: "Source: Lovable Intake · channel=web-form",
      timestamp: t(0),
      state: "complete",
      payload: { event: "claim.received", source: "lovable_intake", payload: buildPayload(claim) },
    },
    {
      id: "A2",
      title: "Data Validation",
      subtitle: "Serial & dealer validated against mock master ledger",
      timestamp: t(320),
      state: "complete",
      payload: {
        event: "claim.validated",
        serial_lookup: { serial_number: claim.serial_number, match: serial, result: serial ? "FOUND" : "NOT_FOUND" },
        dealer_lookup: { dealer_id: claim.dealer_id, match: dealer, result: dealer ? "FOUND" : "NOT_FOUND" },
      },
    },
    {
      id: "A3",
      title: "Rules Executed",
      subtitle: `${analysis.rules.filter((r) => r.status === "pass").length}/${analysis.rules.length} deterministic checks passed`,
      timestamp: t(880),
      state: "complete",
      payload: {
        event: "rules.executed",
        engine: "deterministic-if-logic v2.4",
        results: analysis.rules.map((r) => ({
          id: r.id,
          rule: r.label,
          status: r.status.toUpperCase(),
          weight: r.weight,
          logic: r.evidence,
        })),
      },
    },
    {
      id: "A4",
      title: "NLP Completed",
      subtitle:
        analysis.nlp.source === "ai"
          ? `LLM response returned by ${AI_MODEL}`
          : analysis.nlp.source === "demo"
            ? "Pre-loaded demo record"
            : "AI unavailable · routed to manual review",
      timestamp: t(2400),
      state: "complete",
      payload: {
        event: "nlp.completed",
        model: webhook.url,
        transport: analysis.nlp.source,
        ai_status: webhook.outcome?.status ?? null,
        ai_error: webhook.outcome?.error ?? null,
        request: buildPayload(claim),
        response: {
          narrative_consistency: analysis.nlp.consistency,
          anomaly_flag: analysis.nlp.anomaly_flag,
          model_confidence: analysis.nlp.confidence,
          reasoning: analysis.nlp.reasoning,
          telematics_facts: analysis.nlp.telematics_facts,
        },
      },
    },
    {
      id: "A5",
      title: "Risk Calculated",
      subtitle: `Aggregate score ${analysis.risk_score} · ${analysis.decision}`,
      timestamp: t(2610),
      state: "complete",
      payload: {
        event: "risk.calculated",
        rule_weight_total: analysis.rules.reduce((s, r) => s + r.weight, 0),
        nlp_modifier: analysis.risk_score - analysis.rules.reduce((s, r) => s + r.weight, 0),
        risk_score: analysis.risk_score,
        band: riskBand(analysis.risk_score).label,
        policy_gate_output: analysis.decision,
      },
    },
  ];

  steps.push({
    id: "A6",
    title: "Human Decision",
    subtitle: decision
      ? `${decision.action} by ${decision.reviewer}`
      : "Awaiting Human-In-The-Loop disposition",
    timestamp: decision?.timestamp ?? "",
    state: decision ? "complete" : "pending",
    payload: decision
      ? {
          event: "human.decision",
          action: decision.action,
          reviewer: decision.reviewer,
          note: decision.note,
          recorded_at: decision.timestamp,
          final_state: decision.action === "APPROVED" ? "APPROVED" : decision.action === "REJECTED" ? "REJECTED" : "UNDER_INVESTIGATION",
        }
      : { event: "human.decision", state: "PENDING" },
  });

  return steps;
}

/** Investigate and Reject decisions require a written reason (min 10 chars). */
export const MIN_DECISION_NOTE = 10;
export function isDecisionNoteValid(action: HumanDecision["action"], note: string) {
  return action === "APPROVED" || note.trim().length >= MIN_DECISION_NOTE;
}
