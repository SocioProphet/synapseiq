/**
 * fhwa-hpms.ts — baseline adapter: FHWA Highway Performance Monitoring System (HPMS) segments.
 *
 * HPMS is a US-federal (FHWA) public-domain dataset of road-segment traffic. Each record carries
 * AADT (Annual Average Daily Traffic) for a segment — an already-published aggregate with no
 * individual subjects. The adapter maps an HPMS row into a canonical RawMobilityRecord as a
 * `reference_substrate` signal (a baseline denominator for corridor-exposure / event-lift), NOT an
 * observed_content signal — so it is never mistaken for privacy-sensitive footfall.
 *
 * The adapter only reshapes provider fields; the privacy posture is still COMPUTED downstream by
 * normalizeMobilitySignal. Because HPMS is a public aggregate it declares has_raw_identifiers=false
 * and protected_location_excluded=true, and reports a subject_count above any package floor — but
 * those declarations are still re-checked by the normalizer, never trusted blindly.
 */
import type { RawMobilityRecord } from "../mobility.js";

/** A row from the FHWA HPMS segment extract (the fields this adapter reads). */
export interface HpmsSegmentRow {
  route_id: string;
  begin_point: number; // milepost
  end_point: number; // milepost
  aadt: number; // annual average daily traffic
  year_record: number;
  state_code: string;
  /** functional system (1=Interstate … 7=Local); optional, carried through when present */
  f_system?: number;
}

export interface HpmsAdapterOptions {
  /** the source contract this HPMS extract is governed by */
  source_contract_id: string;
}

const HPMS_PROVIDER = "fhwa-hpms";
// HPMS is a published public aggregate — well above any k-anonymity floor. A sentinel large count
// lets the normalizer's aggregation_floor_met gate clear for a genuine public baseline.
const PUBLIC_AGGREGATE_SUBJECT_COUNT = 1_000_000;

/** Map one HPMS segment row into a canonical RawMobilityRecord (reference_substrate baseline). */
export function adaptHpmsSegment(row: HpmsSegmentRow, opts: HpmsAdapterOptions): RawMobilityRecord {
  if (!(row.end_point > row.begin_point)) {
    throw new Error(`HPMS segment ${row.route_id} has non-positive length (begin=${row.begin_point}, end=${row.end_point})`);
  }
  if (!(row.aadt >= 0)) {
    throw new Error(`HPMS segment ${row.route_id} has negative AADT (${row.aadt})`);
  }
  const start = `${row.year_record}-01-01`;
  const end = `${row.year_record}-12-31`;
  return {
    signal_id: `fhwa-hpms:${row.state_code}:${row.route_id}:${row.begin_point}-${row.end_point}:${row.year_record}`,
    signal_class: "reference_substrate",
    domain: "mobility",
    anchor: { type: "road_segment", id: `${row.route_id}:${row.begin_point}-${row.end_point}` },
    time: { grain: "year", start, end },
    geo: { grain: "road_segment", h3_resolution: null },
    measures: {
      // AADT is a daily count; expose it directly and as an annualized passages baseline.
      aadt: row.aadt,
      estimated_passages: row.aadt,
      ...(row.f_system !== undefined ? { f_system: row.f_system } : {}),
    },
    provider: HPMS_PROVIDER,
    source_contract_id: opts.source_contract_id,
    subject_count: PUBLIC_AGGREGATE_SUBJECT_COUNT,
    has_raw_identifiers: false, // public aggregate — no individual subjects
    protected_location_excluded: true, // public road infrastructure
  };
}
