/**
 * trade-area.ts — the retail trade-area enrichment (first wedge reasoning module).
 *
 * Aggregates observed footfall signals into a trade-area measure, but ONLY from signals the
 * suppression engine ALLOWs — a suppressed or review-pending signal never contributes to a
 * shipped package (fail-closed aggregation). Suppressed signals are returned with their reasons
 * for the audit surface, never silently dropped.
 */
import { assessSuppression, type MobilitySignalLike, type SuppressionContext } from "./mobility-suppression.js";

export interface TradeAreaSignal extends MobilitySignalLike {
  measures: { estimated_visits?: number };
}

export interface TradeAreaResult {
  package_id: "retail_trade_area.v1";
  included: string[];
  suppressed: { signal_id: string; decision: "suppress" | "review"; reasons: string[] }[];
  total_estimated_visits: number;
  contributing_count: number;
}

/** Compute a retail trade-area result from a set of signals under a suppression context. */
export function computeTradeArea(signals: TradeAreaSignal[], ctx: SuppressionContext): TradeAreaResult {
  const included: string[] = [];
  const suppressed: TradeAreaResult["suppressed"] = [];
  let total = 0;

  for (const s of signals) {
    const r = assessSuppression(s, ctx);
    if (r.decision === "allow") {
      included.push(s.signal_id);
      total += Number(s.measures.estimated_visits ?? 0);
    } else {
      suppressed.push({ signal_id: s.signal_id, decision: r.decision, reasons: r.reasons });
    }
  }

  return {
    package_id: "retail_trade_area.v1",
    included,
    suppressed,
    total_estimated_visits: total,
    contributing_count: included.length,
  };
}
