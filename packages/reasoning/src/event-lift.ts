/**
 * event-lift.ts — the event-impact ("lift") enrichment reasoning module.
 *
 * Measures the change in observed visits around an event relative to a baseline, but ONLY from
 * signals the suppression engine ALLOWs — a suppressed or review-pending signal never contributes
 * to a shipped package (fail-closed aggregation). Suppressed signals are returned with their
 * reasons for the audit surface, never silently dropped. Lift is reported as an absolute delta and
 * a ratio; the ratio is only defined when the allowed baseline is positive (else it is null, never
 * a divide-by-zero or a fabricated number).
 */
import { assessSuppression, type MobilitySignalLike, type SuppressionContext } from "./mobility-suppression.js";

export interface EventLiftSignal extends MobilitySignalLike {
  measures: { baseline_visits?: number; observed_visits?: number };
}

export interface EventLiftResult {
  package_id: "event_impact.v1";
  included: string[];
  suppressed: { signal_id: string; decision: "suppress" | "review"; reasons: string[] }[];
  baseline_visits: number;
  observed_visits: number;
  /** observed − baseline over the ALLOWed signals */
  lift: number;
  /** observed / baseline; null when the allowed baseline is 0 (undefined, not fabricated) */
  lift_ratio: number | null;
  contributing_count: number;
}

/** Compute event lift from a set of before/after visit signals under a suppression context. */
export function computeEventLift(signals: EventLiftSignal[], ctx: SuppressionContext): EventLiftResult {
  const included: string[] = [];
  const suppressed: EventLiftResult["suppressed"] = [];
  let baseline = 0;
  let observed = 0;

  for (const s of signals) {
    const r = assessSuppression(s, ctx);
    if (r.decision === "allow") {
      included.push(s.signal_id);
      baseline += Number(s.measures.baseline_visits ?? 0);
      observed += Number(s.measures.observed_visits ?? 0);
    } else {
      suppressed.push({ signal_id: s.signal_id, decision: r.decision, reasons: r.reasons });
    }
  }

  return {
    package_id: "event_impact.v1",
    included,
    suppressed,
    baseline_visits: baseline,
    observed_visits: observed,
    lift: observed - baseline,
    lift_ratio: baseline > 0 ? observed / baseline : null,
    contributing_count: included.length,
  };
}
