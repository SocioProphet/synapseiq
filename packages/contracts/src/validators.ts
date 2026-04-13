import type { CanonicalEnvelope } from "./envelope";

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface EnvelopeValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}

export function validateCanonicalEnvelope(
  envelope: unknown,
): EnvelopeValidationResult {
  const issues: ValidationIssue[] = [];

  if (!envelope || typeof envelope !== "object") {
    return {
      ok: false,
      issues: [{ path: "$", message: "Envelope must be an object" }],
    };
  }

  const doc = envelope as Partial<CanonicalEnvelope> & Record<string, unknown>;

  const requiredTopLevel = [
    "envelope_version",
    "record_kind",
    "record_stage",
    "record_id",
    "record_ts",
    "source",
    "provenance",
    "canonical",
  ];

  for (const key of requiredTopLevel) {
    if (!(key in doc)) {
      issues.push({ path: key, message: `Missing required field: ${key}` });
    }
  }

  if (doc.envelope_version !== undefined && doc.envelope_version !== "1.0.0") {
    issues.push({ path: "envelope_version", message: "Unsupported envelope version" });
  }

  if (doc.source && typeof doc.source === "object") {
    const src = doc.source as Record<string, unknown>;
    if (!src.source_id) {
      issues.push({ path: "source.source_id", message: "Missing source_id" });
    }
    if (!src.source_type) {
      issues.push({ path: "source.source_type", message: "Missing source_type" });
    }
  }

  if (doc.provenance && typeof doc.provenance === "object") {
    const prov = doc.provenance as Record<string, unknown>;
    for (const key of ["ingested_at", "processed_at", "processor", "method"]) {
      if (!(key in prov)) {
        issues.push({ path: `provenance.${key}`, message: `Missing provenance field: ${key}` });
      }
    }
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}
