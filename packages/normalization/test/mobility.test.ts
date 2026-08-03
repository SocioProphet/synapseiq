import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeMobilitySignal, type RawMobilityRecord, type NormalizeOptions } from "../src/mobility.ts";

const raw = (over: Partial<RawMobilityRecord> = {}): RawMobilityRecord => ({
  signal_id: "sig-1",
  anchor: { type: "poi", id: "poi-1" },
  time: { grain: "week", start: "2026-05-25", end: "2026-06-01" },
  geo: { grain: "poi" },
  measures: { estimated_visits: 1000 },
  provider: "acme",
  source_contract_id: "sc-1",
  subject_count: 500,
  has_raw_identifiers: false,
  protected_location_excluded: true,
  ...over,
});

const opts: NormalizeOptions = { min_subjects: 100, ingestion_activity_id: "SIQ-MOB-010", baseline_id: "b1" };

test("a clean record normalizes with all privacy gates cleared", () => {
  const s = normalizeMobilitySignal(raw(), opts);
  assert.equal(s.privacy.raw_identifiers_present, false);
  assert.equal(s.privacy.aggregation_floor_met, true);
  assert.equal(s.privacy.protected_location_excluded, true);
  assert.equal(s.privacy.suppression_reason, null);
  assert.equal(s.provenance.ingestion_activity_id, "SIQ-MOB-010");
});

test("raw identifiers default to PRESENT unless proven absent (fail-closed)", () => {
  const s = normalizeMobilitySignal(raw({ has_raw_identifiers: undefined }), opts);
  assert.equal(s.privacy.raw_identifiers_present, true);
  assert.equal(s.privacy.suppression_reason, "raw identifiers present");
});

test("below the aggregation floor sets the gate false + reason", () => {
  const s = normalizeMobilitySignal(raw({ subject_count: 10 }), opts);
  assert.equal(s.privacy.aggregation_floor_met, false);
  assert.match(s.privacy.suppression_reason ?? "", /aggregation floor/);
});

test("protected location must be asserted excluded (default false)", () => {
  const s = normalizeMobilitySignal(raw({ protected_location_excluded: undefined }), opts);
  assert.equal(s.privacy.protected_location_excluded, false);
  assert.equal(s.privacy.suppression_reason, "protected location not excluded");
});
