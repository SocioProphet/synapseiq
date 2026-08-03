import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCorridorExposure, type CorridorExposureSignal } from "../src/corridor-exposure.ts";
import type { SuppressionContext } from "../src/mobility-suppression.ts";

const ctx: SuppressionContext = {
  targetPackage: "corridor_exposure.v1",
  allowedPackagesForPurpose: ["corridor_exposure.v1"],
};

function sig(
  id: string,
  segment_id: string,
  priv: Partial<CorridorExposureSignal["privacy"]>,
  passages: number,
): CorridorExposureSignal {
  return {
    signal_id: id,
    signal_class: "observed_content",
    anchor: { type: "segment", id: segment_id },
    segment_id,
    privacy: { aggregation_floor_met: true, protected_location_excluded: true, raw_identifiers_present: false, ...priv },
    measures: { estimated_passages: passages },
  };
}

test("only ALLOWed signals contribute, aggregated per segment", () => {
  const r = computeCorridorExposure(
    [
      sig("a", "s1", {}, 100),
      sig("b", "s1", {}, 50),
      sig("c", "s2", {}, 200),
      sig("d", "s2", { raw_identifiers_present: true }, 999), // suppress
    ],
    ctx,
  );
  assert.deepEqual(r.included, ["a", "b", "c"]);
  assert.equal(r.total_estimated_passages, 350);
  assert.equal(r.contributing_count, 3);
  assert.equal(r.suppressed.length, 1);
  // per-segment aggregation, first-seen order
  assert.deepEqual(r.per_segment, [
    { segment_id: "s1", estimated_passages: 150, contributing_count: 2 },
    { segment_id: "s2", estimated_passages: 200, contributing_count: 1 },
  ]);
});

test("a fully-suppressed segment does not appear in per_segment", () => {
  const r = computeCorridorExposure([sig("a", "s1", { protected_location_excluded: false }, 100)], ctx);
  assert.equal(r.total_estimated_passages, 0);
  assert.deepEqual(r.per_segment, []);
  assert.equal(r.suppressed[0].decision, "suppress");
});

test("a purpose that does not permit the package suppresses everything", () => {
  const r = computeCorridorExposure([sig("a", "s1", {}, 100)], {
    ...ctx,
    allowedPackagesForPurpose: ["retail_trade_area.v1"],
  });
  assert.equal(r.included.length, 0);
  assert.equal(r.total_estimated_passages, 0);
  assert.deepEqual(r.per_segment, []);
});
