/**
 * tci.ts — BME §7: the Type Complexity Index ("semantic enthalpy"): invariant depth, dependent structure, proof
 * burden, implicit inference. TCI is NOT "higher is better" — high TCI can mean rigor (protocol invariants,
 * numeric safety) OR overreach (rigid norms). The governance distinction is WITNESSES vs LATENT attributes:
 * witnessed claims (with valid policy + retention) REDUCE identity risk; latent sensitive attributes RAISE it
 * (§7). So `computeTci` returns the complexity score AND the IRI-relevant `injectionContribution` it implies.
 *
 *   TCI = f(dependent_depth, PiSigma_density, witness_attribute_ratio, instance_resolution_density,
 *           equality_edges, reflection_rate, size_index_strictness)
 */

export interface TciInputs {
  dependentDepth: number; // raw nesting depth of dependent types
  piSigmaDensity: number; // [0,1] Π/Σ density per declaration
  witnessAttributeRatio: number; // [0,1] witnessed claims / (witnessed + latent sensitive) — HIGHER is better
  instanceResolutionDensity: number; // resolutions per KLOC
  equalityEdges: number; // raw count of equality-canonicalization edges
  reflectionRate: number; // reflection actions per KLOC
  sizeIndexStrictness: number; // [0,1] how strict the size/termination throttles are
}

export interface TciThresholds {
  warn: number;
  block: number;
  instanceResolutionPerKlocWarn: number; // §7.4: 8
  instanceResolutionPerKlocBlock: number; // §7.4: 15
  reflectionPerKlocWarn: number; // §7.4: 2
  reflectionPerKlocBlock: number; // §7.4: 5
}

export const DEFAULT_TCI_THRESHOLDS: TciThresholds = {
  warn: 0.4,
  block: 0.7,
  instanceResolutionPerKlocWarn: 8,
  instanceResolutionPerKlocBlock: 15,
  reflectionPerKlocWarn: 2,
  reflectionPerKlocBlock: 5,
};

export interface TciResult {
  score: number; // [0,1] raw type-complexity
  decision: "ok" | "review" | "block";
  /** the slice of complexity that comes from LATENT/implicit force (instance resolution, equality, reflection,
   *  low witness ratio) — this is what feeds IRI.injectionNormativity. [0,1]. */
  injectionContribution: number;
  findings: string[];
  components: Record<keyof TciInputs, number>;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const depthNorm = (d: number) => clamp01(d / 8);
const perKlocNorm = (x: number, cap: number) => clamp01(x / cap);

export function computeTci(inp: TciInputs, thresholds: TciThresholds = DEFAULT_TCI_THRESHOLDS): TciResult {
  const components: Record<keyof TciInputs, number> = {
    dependentDepth: depthNorm(inp.dependentDepth),
    piSigmaDensity: clamp01(inp.piSigmaDensity),
    // witness ratio is GOOD → invert so a low witness ratio raises complexity-risk.
    witnessAttributeRatio: 1 - clamp01(inp.witnessAttributeRatio),
    instanceResolutionDensity: perKlocNorm(inp.instanceResolutionDensity, thresholds.instanceResolutionPerKlocBlock),
    equalityEdges: clamp01(inp.equalityEdges / 20),
    reflectionRate: perKlocNorm(inp.reflectionRate, thresholds.reflectionPerKlocBlock),
    sizeIndexStrictness: clamp01(inp.sizeIndexStrictness),
  };
  const w = {
    dependentDepth: 0.18, piSigmaDensity: 0.14, witnessAttributeRatio: 0.18, instanceResolutionDensity: 0.16,
    equalityEdges: 0.14, reflectionRate: 0.12, sizeIndexStrictness: 0.08,
  } as const;
  const score = clamp01((Object.keys(w) as (keyof TciInputs)[]).reduce((s, k) => s + w[k] * components[k], 0));

  // IRI injection contribution: the implicit/normative force — low witness ratio + instance/equality/reflection.
  const injectionContribution = clamp01(
    0.4 * (1 - clamp01(inp.witnessAttributeRatio)) +
    0.25 * components.instanceResolutionDensity +
    0.2 * components.equalityEdges +
    0.15 * components.reflectionRate,
  );

  const findings: string[] = [];
  if (inp.instanceResolutionDensity >= thresholds.instanceResolutionPerKlocBlock) findings.push(`instance-resolution density ${inp.instanceResolutionDensity}/KLOC ≥ block ${thresholds.instanceResolutionPerKlocBlock} (§3)`);
  else if (inp.instanceResolutionDensity >= thresholds.instanceResolutionPerKlocWarn) findings.push(`instance-resolution density ${inp.instanceResolutionDensity}/KLOC ≥ warn ${thresholds.instanceResolutionPerKlocWarn}`);
  if (inp.reflectionRate >= thresholds.reflectionPerKlocBlock) findings.push(`reflection rate ${inp.reflectionRate}/KLOC ≥ block ${thresholds.reflectionPerKlocBlock} (§9)`);
  else if (inp.reflectionRate >= thresholds.reflectionPerKlocWarn) findings.push(`reflection rate ${inp.reflectionRate}/KLOC ≥ warn ${thresholds.reflectionPerKlocWarn}`);
  if (inp.witnessAttributeRatio < 0.5) findings.push(`witness/latent ratio ${inp.witnessAttributeRatio.toFixed(2)} < 0.5 — latent sensitive attributes dominate (raises IRI)`);

  const decision: TciResult["decision"] =
    score >= thresholds.block || inp.instanceResolutionDensity >= thresholds.instanceResolutionPerKlocBlock || inp.reflectionRate >= thresholds.reflectionPerKlocBlock
      ? "block"
      : score >= thresholds.warn ? "review" : "ok";
  return { score, decision, injectionContribution, findings, components };
}
