/**
 * iri.ts — BME §1 / §13: the Identity Risk Index, the primary risk score, plus the surjection/injection/bijection
 * fit classifier (§1, §7.3).
 *
 *   IRI = α·EntropyUniqueness + β·InjectionNormativity − γ·ConsentHoleCredits
 *
 * EntropyUniqueness  — how much choice space (syntax/reflection/dialect/optionality) can identify an actor.
 * InjectionNormativity — how much rigid typing / implicit resolution / equality canonization over-constrains.
 * ConsentHoleCredits — how often the system refuses to infer a sensitive claim and asks for a witness instead.
 * Witnessed refusals REDUCE risk; latent sensitive attributes RAISE it. Target state: bijection.
 */

export interface IriWeights {
  alphaEntropyUniqueness: number;
  betaInjectionNormativity: number;
  gammaConsentHoleCredit: number;
}

export interface IriThresholds {
  warn: number;
  block: number;
}

/** Spec defaults (§13). Domains MAY set stricter values. */
export const DEFAULT_IRI_WEIGHTS: IriWeights = {
  alphaEntropyUniqueness: 0.45,
  betaInjectionNormativity: 0.45,
  gammaConsentHoleCredit: 0.2,
};
export const DEFAULT_IRI_THRESHOLDS: IriThresholds = { warn: 0.35, block: 0.55 };

export interface IriInputs {
  entropyUniqueness: number; // [0,1]
  injectionNormativity: number; // [0,1]
  consentHoleCredits: number; // [0,1]
}

export type IriDecision = "proceed" | "warn" | "block";

export interface IriResult {
  score: number; // clamped to [0,1]
  decision: IriDecision;
  components: { entropy: number; injection: number; consentCredit: number };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

export function computeIri(
  inp: IriInputs,
  weights: IriWeights = DEFAULT_IRI_WEIGHTS,
  thresholds: IriThresholds = DEFAULT_IRI_THRESHOLDS,
): IriResult {
  const entropy = weights.alphaEntropyUniqueness * clamp01(inp.entropyUniqueness);
  const injection = weights.betaInjectionNormativity * clamp01(inp.injectionNormativity);
  const consentCredit = weights.gammaConsentHoleCredit * clamp01(inp.consentHoleCredits);
  const score = clamp01(entropy + injection - consentCredit);
  const decision: IriDecision = score >= thresholds.block ? "block" : score >= thresholds.warn ? "warn" : "proceed";
  return { score, decision, components: { entropy, injection, consentCredit } };
}

// ── §1 / §7.3 fit classifier ────────────────────────────────────────────────────
export type Fit = "surjection" | "injection" | "bijection";

export interface FitInputs {
  /** model accuracy / F1 relative to the expected upper bound, in [0,1] */
  fitToExpected: number;
  /** evidence the model is hunting proxies for missing distinctions (underfit), [0,1] */
  proxyEvidence: number;
  /** how normative/rigid the representation is (overfit to encoded norms), [0,1] */
  normativity: number;
  /** counterfactual / representation stability (CKA-style), [0,1] */
  stability: number;
}

/**
 * Surjection = underfit (low fit, high proxy hunting); Injection = overfit (high fit but rigid/unstable norms);
 * Bijection = calibrated (fit in range + stable + not over-normative).
 */
export function classifyFit(f: FitInputs): Fit {
  if (f.fitToExpected < 0.6 || f.proxyEvidence > 0.5) return "surjection";
  if (f.normativity > 0.6 && f.stability < 0.5) return "injection";
  return "bijection";
}
