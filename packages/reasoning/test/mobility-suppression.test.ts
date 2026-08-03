import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessSuppression,
  allowedPackagesForPurpose,
  type MobilitySignalLike,
  type SuppressionContext,
} from "../src/mobility-suppression.ts";

function signal(over: Partial<MobilitySignalLike["privacy"]> = {}): MobilitySignalLike {
  return {
    signal_id: "sig-1",
    signal_class: "observed_content",
    anchor: { type: "poi", id: "poi-123" },
    privacy: {
      aggregation_floor_met: true,
      protected_location_excluded: true,
      raw_identifiers_present: false,
      ...over,
    },
  };
}

const ctx = (over: Partial<SuppressionContext> = {}): SuppressionContext => ({
  targetPackage: "retail_trade_area.v1",
  allowedPackagesForPurpose: ["retail_trade_area.v1", "ev_logistics_corridor.v1"],
  ...over,
});

test("a clean, permitted, aggregated signal is ALLOWed", () => {
  const r = assessSuppression(signal(), ctx());
  assert.equal(r.decision, "allow");
  assert.deepEqual(r.reasons, []);
});

test("raw identifiers → SUPPRESS (never allowed, no exception)", () => {
  const r = assessSuppression(signal({ raw_identifiers_present: true }), ctx({ reviewedException: true }));
  assert.equal(r.decision, "suppress");
  assert.ok(r.reasons.some((x) => /raw identifiers/.test(x)));
});

test("aggregation floor not met → SUPPRESS", () => {
  assert.equal(assessSuppression(signal({ aggregation_floor_met: false }), ctx()).decision, "suppress");
});

test("purpose does not permit the package → SUPPRESS (permitted-use)", () => {
  const r = assessSuppression(signal(), ctx({ targetPackage: "event_impact.v1" }));
  assert.equal(r.decision, "suppress");
  assert.ok(r.reasons.some((x) => /permitted-use/.test(x)));
});

test("protected location not excluded → SUPPRESS without review, REVIEW with a reviewed exception", () => {
  const s = signal({ protected_location_excluded: false });
  assert.equal(assessSuppression(s, ctx()).decision, "suppress");
  assert.equal(assessSuppression(s, ctx({ reviewedException: true })).decision, "review");
});

test("a reviewed exception cannot rescue a hard block (raw identifiers)", () => {
  const s = signal({ protected_location_excluded: false, raw_identifiers_present: true });
  assert.equal(assessSuppression(s, ctx({ reviewedException: true })).decision, "suppress");
});

test("allowedPackagesForPurpose resolves from a parsed taxonomy", () => {
  const tax = { purposes: { site_selection: { allowed_for_packages: ["retail_trade_area.v1"] } } };
  assert.deepEqual(allowedPackagesForPurpose(tax, "site_selection"), ["retail_trade_area.v1"]);
  assert.deepEqual(allowedPackagesForPurpose(tax, "unknown_purpose"), []);
});
