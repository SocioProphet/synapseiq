import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEventLift, type EventLiftSignal } from "../src/event-lift.ts";
import type { SuppressionContext } from "../src/mobility-suppression.ts";

const ctx: SuppressionContext = {
  targetPackage: "event_impact.v1",
  allowedPackagesForPurpose: ["event_impact.v1"],
};

function sig(
  id: string,
  priv: Partial<EventLiftSignal["privacy"]>,
  baseline: number,
  observed: number,
): EventLiftSignal {
  return {
    signal_id: id,
    signal_class: "observed_content",
    anchor: { type: "poi", id: `poi-${id}` },
    privacy: { aggregation_floor_met: true, protected_location_excluded: true, raw_identifiers_present: false, ...priv },
    measures: { baseline_visits: baseline, observed_visits: observed },
  };
}

test("lift and ratio computed over ALLOWed signals only", () => {
  const r = computeEventLift(
    [
      sig("a", {}, 100, 150),
      sig("b", {}, 100, 130),
      sig("c", { raw_identifiers_present: true }, 1000, 5000), // suppress — must not distort lift
    ],
    ctx,
  );
  assert.deepEqual(r.included, ["a", "b"]);
  assert.equal(r.baseline_visits, 200);
  assert.equal(r.observed_visits, 280);
  assert.equal(r.lift, 80);
  assert.equal(r.lift_ratio, 1.4);
  assert.equal(r.suppressed.length, 1);
});

test("ratio is null (not a divide-by-zero) when allowed baseline is 0", () => {
  const r = computeEventLift([sig("a", {}, 0, 50)], ctx);
  assert.equal(r.baseline_visits, 0);
  assert.equal(r.lift, 50);
  assert.equal(r.lift_ratio, null);
});

test("a purpose that does not permit the package suppresses everything", () => {
  const r = computeEventLift([sig("a", {}, 100, 150)], { ...ctx, allowedPackagesForPurpose: ["site_fit.v1"] });
  assert.equal(r.included.length, 0);
  assert.equal(r.lift, 0);
  assert.equal(r.lift_ratio, null);
});
