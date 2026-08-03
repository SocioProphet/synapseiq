import { test } from "node:test";
import assert from "node:assert/strict";
import { computeSiteFit, type SiteFitSignal } from "../src/site-fit.ts";
import type { SuppressionContext } from "../src/mobility-suppression.ts";

const ctx: SuppressionContext = {
  targetPackage: "site_fit.v1",
  allowedPackagesForPurpose: ["site_fit.v1"],
};

function sig(
  id: string,
  priv: Partial<SiteFitSignal["privacy"]>,
  demand_weight: number,
  fit_score: number,
): SiteFitSignal {
  return {
    signal_id: id,
    signal_class: "observed_content",
    anchor: { type: "candidate_site", id: `site-${id}` },
    privacy: { aggregation_floor_met: true, protected_location_excluded: true, raw_identifiers_present: false, ...priv },
    measures: { demand_weight, fit_score },
  };
}

test("demand-weighted mean fit over ALLOWed signals", () => {
  const r = computeSiteFit(
    [
      sig("a", {}, 3, 1.0), // weight 3, fit 1.0
      sig("b", {}, 1, 0.0), // weight 1, fit 0.0
      sig("c", { protected_location_excluded: false }, 100, 1.0), // suppress — must not skew
    ],
    ctx,
  );
  assert.deepEqual(r.included, ["a", "b"]);
  assert.equal(r.total_demand_weight, 4);
  assert.equal(r.site_fit_score, 0.75); // (3*1 + 1*0) / 4
  assert.equal(r.suppressed.length, 1);
});

test("fit_score and demand_weight are clamped (>1 fit, negative weight)", () => {
  const r = computeSiteFit(
    [
      sig("a", {}, 2, 5), // fit clamped to 1
      sig("b", {}, -10, 1), // weight clamped to 0 → contributes nothing
    ],
    ctx,
  );
  assert.equal(r.total_demand_weight, 2);
  assert.equal(r.site_fit_score, 1); // (2*1) / 2
});

test("score is null (unscored, not fabricated 0) when no allowed positive weight", () => {
  const suppressedOnly = computeSiteFit([sig("a", { raw_identifiers_present: true }, 5, 1)], ctx);
  assert.equal(suppressedOnly.site_fit_score, null);
  assert.equal(suppressedOnly.total_demand_weight, 0);

  const zeroWeight = computeSiteFit([sig("a", {}, 0, 1)], ctx);
  assert.equal(zeroWeight.site_fit_score, null);
});
