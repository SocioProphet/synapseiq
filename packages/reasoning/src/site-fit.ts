/**
 * site-fit.ts — the site-fit enrichment reasoning module.
 *
 * Scores how well a candidate site matches observed demand, but ONLY from demand signals the
 * suppression engine ALLOWs — a suppressed or review-pending signal never contributes to a shipped
 * package (fail-closed aggregation). Suppressed signals are returned with their reasons for the
 * audit surface, never silently dropped.
 *
 * The score is a demand-weighted mean of per-signal fit in [0,1] (each signal's demand_weight is
 * clamped non-negative). With no allowed signals the score is null — an unscored site, never a
 * fabricated 0 that would read as "actively poor fit".
 */
import { assessSuppression, type MobilitySignalLike, type SuppressionContext } from "./mobility-suppression.js";

export interface SiteFitSignal extends MobilitySignalLike {
  measures: {
    /** relative importance of this demand signal; clamped to >= 0 */
    demand_weight?: number;
    /** how well the site serves this demand, expected in [0,1]; clamped to [0,1] */
    fit_score?: number;
  };
}

export interface SiteFitResult {
  package_id: "site_fit.v1";
  included: string[];
  suppressed: { signal_id: string; decision: "suppress" | "review"; reasons: string[] }[];
  /** demand-weighted mean fit in [0,1]; null when no allowed signal carries positive weight */
  site_fit_score: number | null;
  total_demand_weight: number;
  contributing_count: number;
}

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

/** Compute a site-fit score from a set of demand signals under a suppression context. */
export function computeSiteFit(signals: SiteFitSignal[], ctx: SuppressionContext): SiteFitResult {
  const included: string[] = [];
  const suppressed: SiteFitResult["suppressed"] = [];
  let weightedSum = 0;
  let totalWeight = 0;

  for (const s of signals) {
    const r = assessSuppression(s, ctx);
    if (r.decision === "allow") {
      included.push(s.signal_id);
      const weight = Math.max(0, Number(s.measures.demand_weight ?? 0));
      const fit = clamp(Number(s.measures.fit_score ?? 0), 0, 1);
      weightedSum += weight * fit;
      totalWeight += weight;
    } else {
      suppressed.push({ signal_id: s.signal_id, decision: r.decision, reasons: r.reasons });
    }
  }

  return {
    package_id: "site_fit.v1",
    included,
    suppressed,
    site_fit_score: totalWeight > 0 ? weightedSum / totalWeight : null,
    total_demand_weight: totalWeight,
    contributing_count: included.length,
  };
}
