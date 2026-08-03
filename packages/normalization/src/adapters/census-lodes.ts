/**
 * census-lodes.ts — baseline adapter: US Census LEHD Origin-Destination Employment Statistics (LODES).
 *
 * LODES is a US-federal (Census Bureau) public-domain dataset. Its WAC (Workplace Area
 * Characteristics) tables report job counts per census block — a published aggregate that the
 * Census already protects with infusion noise, so there are no individual subjects to expose. The
 * adapter maps a LODES WAC row into a canonical RawMobilityRecord as a `reference_substrate` signal
 * — a daytime-population / demand baseline for site-fit and event-lift, never observed footfall.
 *
 * As with the HPMS adapter, this only reshapes provider fields; normalizeMobilitySignal still
 * COMPUTES and re-checks the privacy gates. LODES declares has_raw_identifiers=false and
 * protected_location_excluded=true (public, noise-infused aggregate) with a public-aggregate
 * subject_count.
 */
import type { RawMobilityRecord } from "../mobility.js";

/** A row from a LODES WAC extract (the fields this adapter reads). */
export interface LodesWacRow {
  /** 15-digit census block GEOID (workplace) */
  w_geocode: string;
  /** C000 — total number of jobs */
  c000: number;
  /** LODES data year */
  year: number;
  /** state postal / FIPS the extract was pulled for */
  state: string;
  /** workforce segment: total (S000), or an age/earnings/industry cut; defaults to total */
  segment?: string;
}

export interface LodesAdapterOptions {
  source_contract_id: string;
}

const LODES_PROVIDER = "census-lodes";
const PUBLIC_AGGREGATE_SUBJECT_COUNT = 1_000_000;

/** Map one LODES WAC row into a canonical RawMobilityRecord (reference_substrate baseline). */
export function adaptLodesWac(row: LodesWacRow, opts: LodesAdapterOptions): RawMobilityRecord {
  if (!(row.c000 >= 0)) {
    throw new Error(`LODES block ${row.w_geocode} has negative job count (${row.c000})`);
  }
  if (!/^\d{15}$/.test(row.w_geocode)) {
    throw new Error(`LODES w_geocode '${row.w_geocode}' is not a 15-digit census block GEOID`);
  }
  const segment = row.segment ?? "S000";
  return {
    signal_id: `census-lodes:${row.w_geocode}:${segment}:${row.year}`,
    signal_class: "reference_substrate",
    domain: "mobility",
    anchor: { type: "census_block", id: row.w_geocode },
    time: { grain: "year", start: `${row.year}-01-01`, end: `${row.year}-12-31` },
    geo: { grain: "census_block", h3_resolution: null },
    measures: {
      jobs: row.c000,
      // a workplace jobs count is a daytime-demand baseline for site-fit / event-lift denominators.
      baseline_visits: row.c000,
      segment,
    },
    provider: LODES_PROVIDER,
    source_contract_id: opts.source_contract_id,
    subject_count: PUBLIC_AGGREGATE_SUBJECT_COUNT,
    has_raw_identifiers: false, // Census noise-infused public aggregate
    protected_location_excluded: true,
  };
}
