import type { CanonicalEnvelope } from "@socioprophet/synapseiq-contracts";

/**
 * enrichEnvelope — the semantic-enrichment step, made REAL.
 *
 * Was a no-op passthrough. This is deterministic, rule-based enrichment (honest — no model call): it
 * normalizes entity/link names, aligns each entity's type to the estate's KKO upper ontology (Peirce's
 * Firstness/Secondness/Thirdness → Possibilities/Particulars/Generals), advances the record stage, and
 * stamps provenance + confidence so downstream (the HellGraph sink, new-hope, slash-topics, Holmes) gets
 * a graph-native, trace-backed record instead of a raw one. Pure + synchronous → trivially testable.
 */
export function enrichEnvelope<TCanonical = Record<string, unknown>>(
  envelope: CanonicalEnvelope<TCanonical>,
): CanonicalEnvelope<TCanonical> {
  const now = new Date().toISOString();
  const canonical = { ...(envelope.canonical as Record<string, unknown>) };
  const fieldConfidence: Record<string, number> = {};
  const applied: string[] = [];

  if (envelope.record_kind === "entity") {
    const display = String(canonical["display_name"] ?? canonical["normalized_name"] ?? "");
    if (display && !canonical["normalized_name"]) {
      canonical["normalized_name"] = normalizeName(display);
      applied.push("normalized_name");
      fieldConfidence["normalized_name"] = 1;
    }
    const attrs = { ...((canonical["attributes"] as Record<string, unknown>) ?? {}) };
    if (!attrs["kko_class"]) {
      attrs["kko_class"] = kkoClassOf(String(canonical["entity_type"] ?? ""));
      applied.push("kko_alignment");
      fieldConfidence["kko_class"] = 0.9;
    }
    canonical["attributes"] = attrs;
  } else if (envelope.record_kind === "link") {
    const lt = String(canonical["link_type"] ?? "");
    if (lt) {
      const norm = normalizeToken(lt);
      if (norm !== lt) {
        canonical["link_type"] = norm;
        applied.push("link_type_normalized");
      }
    }
  }

  const confVals = Object.values(fieldConfidence);
  const overall = confVals.length
    ? confVals.reduce((a, b) => a + b, 0) / confVals.length
    : envelope.confidence?.overall ?? null;

  return {
    ...envelope,
    record_stage: "enriched",
    canonical: canonical as TCanonical,
    provenance: {
      ...envelope.provenance,
      processed_at: now,
      processor: "synapseiq-enrichment",
      processor_version: "0.1.0",
      method: "rule",
    },
    confidence: {
      overall,
      field_confidence: { ...(envelope.confidence?.field_confidence ?? {}), ...fieldConfidence },
      explanation_ref: envelope.confidence?.explanation_ref ?? null,
    },
    explanations: [
      ...(envelope.explanations ?? []),
      { enricher: "synapseiq-enrichment/rule-v0", applied },
    ],
  };
}

/** Canonical display form: collapse whitespace, strip surrounding punctuation, lowercase. */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").toLowerCase();
}

/** Canonical relation token: UPPER_SNAKE (SUPPORTS, WORKS_AT) — the graph edge-label convention. */
export function normalizeToken(token: string): string {
  return token.trim().replace(/[\s-]+/g, "_").replace(/[^\w]/g, "").toUpperCase();
}

/**
 * Align a source entity_type to the KKO upper ontology (the estate standard). Peircean categories:
 * Generals (Thirdness) = types/classes/concepts; Possibilities (Firstness) = qualities; else the entity
 * is a Particular (Secondness) — the default for named things (org/person/place/product).
 */
export function kkoClassOf(entityType: string): "Particulars" | "Generals" | "Possibilities" {
  const t = entityType.toLowerCase();
  if (/type|class|concept|category|kind|taxonom|ontolog/.test(t)) return "Generals";
  if (/quality|possibility|attribute|property|feeling|potential/.test(t)) return "Possibilities";
  return "Particulars";
}

export * from "./hellgraph-sink";
