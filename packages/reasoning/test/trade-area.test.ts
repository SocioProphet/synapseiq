import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTradeArea, type TradeAreaSignal } from "../src/trade-area.ts";
import type { SuppressionContext } from "../src/mobility-suppression.ts";

const ctx: SuppressionContext = {
  targetPackage: "retail_trade_area.v1",
  allowedPackagesForPurpose: ["retail_trade_area.v1"],
};

function sig(id: string, priv: Partial<TradeAreaSignal["privacy"]>, visits: number): TradeAreaSignal {
  return {
    signal_id: id,
    signal_class: "observed_content",
    anchor: { type: "poi", id: `poi-${id}` },
    privacy: { aggregation_floor_met: true, protected_location_excluded: true, raw_identifiers_present: false, ...priv },
    measures: { estimated_visits: visits },
  };
}

test("only ALLOWed signals contribute to the trade-area aggregate", () => {
  const r = computeTradeArea(
    [
      sig("a", {}, 1000),                                   // allow
      sig("b", { raw_identifiers_present: true }, 500),     // suppress (raw ids)
      sig("c", { protected_location_excluded: false }, 700), // suppress (protected)
    ],
    ctx,
  );
  assert.deepEqual(r.included, ["a"]);
  assert.equal(r.total_estimated_visits, 1000); // b + c excluded
  assert.equal(r.contributing_count, 1);
  assert.equal(r.suppressed.length, 2);
  assert.equal(r.package_id, "retail_trade_area.v1");
});

test("a purpose that does not permit the package suppresses everything", () => {
  const r = computeTradeArea([sig("a", {}, 1000)], { ...ctx, allowedPackagesForPurpose: ["event_impact.v1"] });
  assert.equal(r.included.length, 0);
  assert.equal(r.total_estimated_visits, 0);
});
