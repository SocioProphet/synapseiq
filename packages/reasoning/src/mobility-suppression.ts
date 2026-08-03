/**
 * mobility-suppression.ts — the privacy-critical suppression engine for the SynapseIQ mobility lane.
 *
 * Decides, fail-closed, whether an observed MobilitySignal may flow into a governed enrichment
 * package. It enforces the mobility privacy posture directly from the signal's declared gates
 * (mobility-signal.v1: aggregation_floor_met / protected_location_excluded / raw_identifiers_present)
 * plus permitted-use (package-purpose taxonomy). A signal is ALLOWed only when every gate passes; a
 * protected-location signal without exclusion is SUPPRESSed unless a reviewed exception routes it to
 * human REVIEW (protected-location-taxonomy default_policy: suppress_from_standard_packages +
 * require_review_for_exception). Nothing is silently allowed.
 */

export type SuppressionDecision = "allow" | "suppress" | "review";

/** The privacy gates carried on every mobility-signal.v1. */
export interface MobilitySignalPrivacy {
  aggregation_floor_met: boolean;
  protected_location_excluded: boolean;
  raw_identifiers_present: boolean;
}

/** The minimal shape of a mobility signal this engine reads (a subset of mobility-signal.v1). */
export interface MobilitySignalLike {
  signal_id: string;
  signal_class: "observed_content" | "reference_substrate" | "derived_enrichment";
  anchor: { type: string; id: string };
  privacy: MobilitySignalPrivacy;
}

export interface SuppressionContext {
  /** the enrichment package the signal would feed, e.g. "retail_trade_area.v1" */
  targetPackage: string;
  /** packages the caller's purpose permits (resolved from the package-purpose taxonomy) */
  allowedPackagesForPurpose: string[];
  /** a human-reviewed exception exists for a protected-location signal */
  reviewedException?: boolean;
}

export interface SuppressionResult {
  decision: SuppressionDecision;
  reasons: string[];
}

/**
 * Assess whether a signal may flow into ``ctx.targetPackage``. Fail-closed:
 *  - raw identifiers present            → suppress (never allowed)
 *  - aggregation floor not met          → suppress (below k-anonymity)
 *  - purpose does not permit package    → suppress (permitted-use)
 *  - protected location not excluded    → review if a reviewed exception exists, else suppress
 *  - otherwise                          → allow
 */
export function assessSuppression(signal: MobilitySignalLike, ctx: SuppressionContext): SuppressionResult {
  const reasons: string[] = [];
  const p = signal.privacy;

  if (p.raw_identifiers_present) reasons.push("raw identifiers present — never permitted");
  if (!p.aggregation_floor_met) reasons.push("aggregation floor not met (below k-anonymity minimum)");
  const purposePermits = ctx.allowedPackagesForPurpose.includes(ctx.targetPackage);
  if (!purposePermits) reasons.push(`purpose does not permit package '${ctx.targetPackage}' (permitted-use)`);

  // hard blocks: no exception can rescue these.
  if (p.raw_identifiers_present || !p.aggregation_floor_met || !purposePermits) {
    return { decision: "suppress", reasons };
  }
  // protected-location gate: suppress from standard packages; a reviewed exception → human review.
  if (!p.protected_location_excluded) {
    reasons.push("anchored at/near a protected location and not excluded");
    return { decision: ctx.reviewedException ? "review" : "suppress", reasons };
  }
  return { decision: "allow", reasons: [] };
}

/** The package-purpose taxonomy shape (parsed from package-purpose-taxonomy.v1.yaml). */
export interface PackagePurposeTaxonomy {
  purposes: Record<string, { allowed_for_packages?: string[] }>;
}

/** Resolve the packages a purpose permits from a parsed taxonomy (empty for an unknown purpose). */
export function allowedPackagesForPurpose(taxonomy: PackagePurposeTaxonomy, purpose: string): string[] {
  return taxonomy.purposes?.[purpose]?.allowed_for_packages ?? [];
}
