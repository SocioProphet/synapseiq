/**
 * audit-harness.ts — BME §7.1–7.4: the audit harness ties the three indices into one report. It computes GCI
 * (grammar entropy) and TCI (type/semantic complexity), DERIVES the IRI inputs from them (entropy-uniqueness from
 * GCI, injection-normativity from TCI's implicit-force contribution, minus consent-hole credits), classifies the
 * fit (surjection/injection/bijection), and produces the CI gate verdict (§22). Pure + composable.
 */
import { computeIri, classifyFit, type IriResult, type Fit } from "./iri.js";
import { computeGci, type GciInputs, type GciResult } from "./gci.js";
import { computeTci, type TciInputs, type TciResult } from "./tci.js";

export interface AuditInputs {
  gci: GciInputs;
  tci: TciInputs;
  /** how often the system refuses to infer a sensitive claim and asks for a witness instead, [0,1] (raises credits) */
  consentHoleCredits: number;
  /** optional evidence the model is hunting proxies (underfit), [0,1] */
  proxyEvidence?: number;
  /** optional representation stability (CKA-style), [0,1] */
  stability?: number;
  /** optional model fit to expected upper bound, [0,1] */
  fitToExpected?: number;
}

export type AuditDecision = "proceed" | "review" | "block";

export interface AuditReport {
  iri: IriResult;
  gci: GciResult;
  tci: TciResult;
  fit: Fit;
  decision: AuditDecision; // the CI gate verdict (§22): block if ANY index blocks or IRI blocks
  findings: string[]; // union of all index findings + the deciding reasons
}

/**
 * Run the full audit. EntropyUniqueness is taken from the GCI score (syntax/dialect choice space identifies
 * actors); InjectionNormativity from TCI's implicit-force contribution (instance search, equality canonization,
 * low witness ratio over-constrain identity); consent-hole credits subtract. The gate BLOCKS if any of IRI / GCI
 * / TCI blocks — fail-closed.
 */
export function auditArtifact(inp: AuditInputs): AuditReport {
  const gci = computeGci(inp.gci);
  const tci = computeTci(inp.tci);

  const iri = computeIri({
    entropyUniqueness: gci.score,
    injectionNormativity: tci.injectionContribution,
    consentHoleCredits: inp.consentHoleCredits,
  });

  const fit = classifyFit({
    fitToExpected: inp.fitToExpected ?? 0.75,
    proxyEvidence: inp.proxyEvidence ?? gci.score, // high grammar entropy with no semantic need ≈ proxy hunting
    normativity: tci.injectionContribution,
    stability: inp.stability ?? 0.7,
  });

  const findings = [
    ...iri.decision !== "proceed" ? [`IRI ${iri.score.toFixed(2)} → ${iri.decision}`] : [],
    ...gci.findings.map((f) => `GCI: ${f}`),
    ...tci.findings.map((f) => `TCI: ${f}`),
  ];

  // fail-closed: any blocking index blocks the gate; any warn/review escalates to review.
  const anyBlock = iri.decision === "block" || gci.decision === "block" || tci.decision === "block";
  const anyReview = iri.decision === "warn" || gci.decision === "review" || tci.decision === "review";
  const decision: AuditDecision = anyBlock ? "block" : anyReview ? "review" : "proceed";

  return { iri, gci, tci, fit, decision, findings };
}
