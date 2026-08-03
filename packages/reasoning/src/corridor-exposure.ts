/**
 * corridor-exposure.ts — the corridor-exposure enrichment reasoning module.
 *
 * Aggregates observed passage signals along a corridor (an ordered set of segments) into an
 * exposure measure, but ONLY from signals the suppression engine ALLOWs — a suppressed or
 * review-pending signal never contributes to a shipped package (fail-closed aggregation).
 * Suppressed signals are returned with their reasons for the audit surface, never silently
 * dropped. Exposure is reported per segment and in total so a masked/thin segment stays visible.
 */
import { assessSuppression, type MobilitySignalLike, type SuppressionContext } from "./mobility-suppression.js";

export interface CorridorExposureSignal extends MobilitySignalLike {
  /** the corridor segment this signal was observed on */
  segment_id: string;
  measures: { estimated_passages?: number };
}

export interface CorridorExposureResult {
  package_id: "corridor_traffic_exposure.v1";
  included: string[];
  suppressed: { signal_id: string; decision: "suppress" | "review"; reasons: string[] }[];
  /** exposure per segment, only from ALLOWed signals (segments with no allowed signal are absent) */
  per_segment: { segment_id: string; estimated_passages: number; contributing_count: number }[];
  total_estimated_passages: number;
  contributing_count: number;
}

/** Compute corridor exposure from a set of passage signals under a suppression context. */
export function computeCorridorExposure(
  signals: CorridorExposureSignal[],
  ctx: SuppressionContext,
): CorridorExposureResult {
  const included: string[] = [];
  const suppressed: CorridorExposureResult["suppressed"] = [];
  // preserve first-seen segment order so the report is deterministic.
  const segments = new Map<string, { estimated_passages: number; contributing_count: number }>();
  let total = 0;

  for (const s of signals) {
    const r = assessSuppression(s, ctx);
    if (r.decision === "allow") {
      included.push(s.signal_id);
      const passages = Number(s.measures.estimated_passages ?? 0);
      total += passages;
      const seg = segments.get(s.segment_id) ?? { estimated_passages: 0, contributing_count: 0 };
      seg.estimated_passages += passages;
      seg.contributing_count += 1;
      segments.set(s.segment_id, seg);
    } else {
      suppressed.push({ signal_id: s.signal_id, decision: r.decision, reasons: r.reasons });
    }
  }

  return {
    package_id: "corridor_traffic_exposure.v1",
    included,
    suppressed,
    per_segment: [...segments].map(([segment_id, v]) => ({ segment_id, ...v })),
    total_estimated_passages: total,
    contributing_count: included.length,
  };
}
