import { test } from "node:test";
import assert from "node:assert/strict";
import { adaptHpmsSegment, type HpmsSegmentRow } from "../src/adapters/fhwa-hpms.ts";
import { adaptLodesWac, type LodesWacRow } from "../src/adapters/census-lodes.ts";
import { normalizeMobilitySignal, type NormalizeOptions } from "../src/mobility.ts";

const opts: NormalizeOptions = { min_subjects: 100, ingestion_activity_id: "SIQ-MOB-011", baseline_id: "baseline-2023" };

// ---- FHWA HPMS ----

const hpmsRow = (over: Partial<HpmsSegmentRow> = {}): HpmsSegmentRow => ({
  route_id: "I-90",
  begin_point: 10.0,
  end_point: 12.5,
  aadt: 48000,
  year_record: 2023,
  state_code: "WA",
  f_system: 1,
  ...over,
});

test("HPMS segment adapts to a reference_substrate baseline that clears every privacy gate", () => {
  const raw = adaptHpmsSegment(hpmsRow(), { source_contract_id: "sc-hpms" });
  assert.equal(raw.signal_class, "reference_substrate");
  assert.equal(raw.has_raw_identifiers, false);
  assert.equal(raw.measures.estimated_passages, 48000);
  assert.equal(raw.measures.aadt, 48000);

  const s = normalizeMobilitySignal(raw, opts);
  assert.equal(s.privacy.suppression_reason, null); // a public baseline is never suppressed
  assert.equal(s.privacy.raw_identifiers_present, false);
  assert.equal(s.privacy.aggregation_floor_met, true);
  assert.equal(s.signal_class, "reference_substrate");
  assert.equal(s.anchor.type, "road_segment");
  assert.match(s.signal_id, /^fhwa-hpms:WA:I-90:10-12\.5:2023$/);
});

test("HPMS rejects a non-positive-length segment and negative AADT (fail-closed on bad input)", () => {
  assert.throws(() => adaptHpmsSegment(hpmsRow({ begin_point: 12, end_point: 12 }), { source_contract_id: "x" }), /length/);
  assert.throws(() => adaptHpmsSegment(hpmsRow({ aadt: -1 }), { source_contract_id: "x" }), /AADT/);
});

test("HPMS omits f_system from measures when absent", () => {
  const raw = adaptHpmsSegment(hpmsRow({ f_system: undefined }), { source_contract_id: "x" });
  assert.equal("f_system" in raw.measures, false);
});

// ---- Census LODES ----

const lodesRow = (over: Partial<LodesWacRow> = {}): LodesWacRow => ({
  w_geocode: "530330001001001",
  c000: 320,
  year: 2022,
  state: "wa",
  ...over,
});

test("LODES WAC adapts to a reference_substrate demand baseline that clears every gate", () => {
  const raw = adaptLodesWac(lodesRow(), { source_contract_id: "sc-lodes" });
  assert.equal(raw.signal_class, "reference_substrate");
  assert.equal(raw.measures.jobs, 320);
  assert.equal(raw.measures.baseline_visits, 320);
  assert.equal(raw.measures.segment, "S000");

  const s = normalizeMobilitySignal(raw, opts);
  assert.equal(s.privacy.suppression_reason, null);
  assert.equal(s.anchor.type, "census_block");
  assert.match(s.signal_id, /^census-lodes:530330001001001:S000:2022$/);
});

test("LODES rejects a malformed geocode and negative job count", () => {
  assert.throws(() => adaptLodesWac(lodesRow({ w_geocode: "5303300010" }), { source_contract_id: "x" }), /GEOID/);
  assert.throws(() => adaptLodesWac(lodesRow({ c000: -5 }), { source_contract_id: "x" }), /job count/);
});

test("LODES carries a non-default workforce segment through", () => {
  const raw = adaptLodesWac(lodesRow({ segment: "SA01" }), { source_contract_id: "x" });
  assert.equal(raw.measures.segment, "SA01");
  assert.match(raw.signal_id, /:SA01:/);
});
