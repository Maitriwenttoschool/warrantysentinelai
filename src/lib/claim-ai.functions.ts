import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { AI_MODEL, runRules, type NlpResult } from "./warranty-engine";

const ClaimSchema = z.object({
  claim_id: z.string().max(64),
  serial_number: z.string().max(64),
  dealer_id: z.string().max(64),
  repair_type: z.enum(["Engine Overhaul", "Hydraulic Pump Replacement", "Seal Replacement", "Transmission Service"]),
  labor_hours: z.number().min(0).max(10000),
  claim_amount: z.number().min(0).max(1e9),
  narrative: z.string().max(8000),
});

export interface AiOutcome {
  ok: boolean;
  status?: number;
  error?: string;
  nlp?: NlpResult;
  model: string;
}

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["consistency", "anomaly_flag", "reasoning", "confidence", "telematics_facts"],
  properties: {
    consistency: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
    anomaly_flag: { type: "boolean" },
    reasoning: { type: "string" },
    confidence: { type: "integer", minimum: 0, maximum: 100 },
    telematics_facts: { type: "array", items: { type: "string" } },
  },
};

const INSTRUCTIONS = `You are a heavy-equipment warranty claims analyst. Assess whether the failure narrative is consistent with the structured claim fields, the deterministic rule findings, and any telematics/IoT facts mentioned. Flag anomalies such as operator neglect reframed as defects, labor padding, serial/grey-market issues, or narrative shaping. Return:
- consistency: HIGH, MEDIUM or LOW narrative consistency
- anomaly_flag: true if anything warrants reviewer attention
- reasoning: 2-5 sentences of concrete, evidence-based explanation
- confidence: your confidence 0-100
- telematics_facts: short factual statements extracted from the narrative (may be empty)`;

export const analyzeClaimAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ClaimSchema.parse(d))
  .handler(async ({ data }): Promise<AiOutcome> => {
    const key = process.env["LOVABLE_API_KEY"];
    if (!key) return { ok: false, error: "AI service is not configured", model: AI_MODEL };
    const rules = runRules(data).map((r) => ({ rule: r.label, status: r.status, detail: r.detail }));
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "X-Lovable-AIG-SDK": "fetch",
        },
        body: JSON.stringify({
          model: AI_MODEL,
          stream: true,
          store: false,
          reasoning: { effort: "low" },
          instructions: INSTRUCTIONS,
          input: JSON.stringify({ claim: data, deterministic_findings: rules }),
          text: { format: { type: "json_schema", name: "claim_analysis", strict: true, schema: SCHEMA } },
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        console.error("AI gateway error", res.status, body);
        let msg = `AI service responded ${res.status}`;
        try {
          msg = JSON.parse(body)?.error?.message ?? JSON.parse(body)?.message ?? msg;
        } catch {}
        return { ok: false, status: res.status, error: msg, model: AI_MODEL };
      }
      // Consume SSE stream, accumulate output text.
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let text = "";
      let failed: string | null = null;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const frame = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const ev = JSON.parse(payload);
              if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
              else if (ev.type === "response.failed" || ev.type === "error")
                failed = ev.response?.error?.message ?? ev.message ?? "AI response failed";
              else if (ev.type === "response.refusal.delta") failed = "AI declined to analyze this claim";
            } catch {}
          }
        }
      }
      if (failed) return { ok: false, status: 200, error: failed, model: AI_MODEL };
      const parsed = JSON.parse(text) as Omit<NlpResult, "source">;
      return { ok: true, status: 200, model: AI_MODEL, nlp: { ...parsed, source: "ai" } };
    } catch (e) {
      console.error("AI analysis failed", e);
      return { ok: false, error: e instanceof Error ? e.message : "AI request failed", model: AI_MODEL };
    }
  });
