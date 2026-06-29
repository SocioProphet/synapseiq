/**
 * gci.ts — BME §5 / §14 / §7.4: the Grammar Complexity Index. Measures grammar entropy — when syntax becomes a
 * fingerprinting surface. High GCI may be legitimate for expressive DSLs, but MUST be justified and backed by
 * tests. The external-token share and scanner recovery feed the dedicated CI gates (§7.4, §14).
 *
 *   GCI = f(operator_count, fixity_graph_density, precedence_density, ambiguity_ratio,
 *           external_token_share, recovery_rate, scanner_health)
 */

export interface GciInputs {
  operatorCount: number; // raw count of declared operators/tokens
  fixityGraphDensity: number; // [0,1] density of the fixity/precedence relation graph
  precedenceDensity: number; // [0,1]
  ambiguityRatio: number; // [0,1] conflicts / productions
  externalTokenShare: number; // [0,1] external-scanner tokens / total tokens
  recoveryRate: number; // [0,1] fraction of error-recovery scans handled by a safe sentinel (HIGHER is better)
  scannerHealth: number; // [0,1] serialize/deserialize + fuzz health (HIGHER is better)
}

export interface GciThresholds {
  warn: number;
  block: number;
  externalTokenShareWarn: number;
  externalTokenShareBlock: number;
}

/** §7.4 defaults: external_token_share warn 0.15 / block 0.30. Overall GCI warn/block are conservative defaults. */
export const DEFAULT_GCI_THRESHOLDS: GciThresholds = {
  warn: 0.35,
  block: 0.6,
  externalTokenShareWarn: 0.15,
  externalTokenShareBlock: 0.3,
};

export interface GciResult {
  score: number; // [0,1] — higher = more grammar entropy / fingerprinting surface
  decision: "ok" | "review" | "block";
  findings: string[];
  components: Record<keyof GciInputs, number>;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
// operator count saturates: ~40 operators → ≈1.0 (log-ish via a soft cap)
const opNorm = (n: number) => clamp01(n / 40);

export function computeGci(inp: GciInputs, thresholds: GciThresholds = DEFAULT_GCI_THRESHOLDS): GciResult {
  // recovery + scanner health are GOOD signals → enter as (1 - health) so poor health raises GCI.
  const components: Record<keyof GciInputs, number> = {
    operatorCount: opNorm(inp.operatorCount),
    fixityGraphDensity: clamp01(inp.fixityGraphDensity),
    precedenceDensity: clamp01(inp.precedenceDensity),
    ambiguityRatio: clamp01(inp.ambiguityRatio),
    externalTokenShare: clamp01(inp.externalTokenShare),
    recoveryRate: 1 - clamp01(inp.recoveryRate),
    scannerHealth: 1 - clamp01(inp.scannerHealth),
  };
  // weights: entropy-bearing surfaces dominate; scanner hygiene is a meaningful but smaller term.
  const w = {
    operatorCount: 0.18, fixityGraphDensity: 0.15, precedenceDensity: 0.12, ambiguityRatio: 0.2,
    externalTokenShare: 0.15, recoveryRate: 0.1, scannerHealth: 0.1,
  } as const;
  const score = clamp01((Object.keys(w) as (keyof GciInputs)[]).reduce((s, k) => s + w[k] * components[k], 0));

  const findings: string[] = [];
  if (inp.externalTokenShare >= thresholds.externalTokenShareBlock) findings.push(`external-token share ${inp.externalTokenShare.toFixed(2)} ≥ block ${thresholds.externalTokenShareBlock} (§14)`);
  else if (inp.externalTokenShare >= thresholds.externalTokenShareWarn) findings.push(`external-token share ${inp.externalTokenShare.toFixed(2)} ≥ warn ${thresholds.externalTokenShareWarn}`);
  if (inp.recoveryRate < 0.9) findings.push(`scanner recovery rate ${inp.recoveryRate.toFixed(2)} < 0.9 — sentinel coverage incomplete (§14)`);
  if (inp.ambiguityRatio > 0.2) findings.push(`ambiguity ratio ${inp.ambiguityRatio.toFixed(2)} high — grammar conflicts`);

  const blocked = score >= thresholds.block || inp.externalTokenShare >= thresholds.externalTokenShareBlock;
  const decision: GciResult["decision"] = blocked ? "block" : score >= thresholds.warn ? "review" : "ok";
  return { score, decision, findings, components };
}
