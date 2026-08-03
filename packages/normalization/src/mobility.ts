/**
 * mobility.ts — normalize a provider's raw mobility record into a canonical MobilitySignal.
 *
 * The normalizer is where the privacy posture is *computed* (not trusted): it derives the
 * mobility-signal.v1 privacy gates fail-closed from the raw record —
 *   - raw_identifiers_present   defaults TRUE unless the provider proves their absence;
 *   - aggregation_floor_met     true only when subject_count ≥ the package's min_subjects;
 *   - protected_location_excluded true only when the raw record asserts exclusion;
 * and stamps the first failing gate as suppression_reason. Everything downstream (the suppression
 * engine, enrichment packages) reads these computed gates rather than provider claims.
 */

export interface MobilitySignalPrivacy {
  aggregation_floor_met: boolean;
  protected_location_excluded: boolean;
  raw_identifiers_present: boolean;
  suppression_reason: string | null;
}

export interface MobilitySignal {
  signal_id: string;
  signal_class: "observed_content" | "reference_substrate" | "derived_enrichment";
  domain: string;
  anchor: { type: string; id: string };
  time: { grain: string; start: string; end: string };
  geo: { grain: string; h3_resolution: number | null };
  measures: Record<string, unknown>;
  provenance: {
    provider: string;
    source_contract_id: string;
    ingestion_activity_id: string;
    baseline_id: string;
  };
  privacy: MobilitySignalPrivacy;
  license: { constraints: string[] };
  confidence: { score: number; method: string };
}

/** A raw provider record (loosely typed — it is the untrusted input). */
export interface RawMobilityRecord {
  signal_id: string;
  signal_class?: MobilitySignal["signal_class"];
  domain?: string;
  anchor: { type: string; id: string };
  time: { grain: string; start: string; end: string };
  geo: { grain: string; h3_resolution?: number | null };
  measures: Record<string, unknown>;
  provider: string;
  source_contract_id: string;
  subject_count?: number;                 // number of distinct subjects behind the aggregate
  has_raw_identifiers?: boolean;          // provider must PROVE false to clear the gate
  protected_location_excluded?: boolean;  // provider must assert true to clear the gate
}

export interface NormalizeOptions {
  min_subjects: number;                   // the target package's aggregation floor
  ingestion_activity_id: string;          // the UCM activity this ingest runs under
  baseline_id: string;
  license_constraints?: string[];
  confidence?: { score: number; method: string };
}

/** Normalize a raw provider record into a canonical MobilitySignal (privacy gates computed fail-closed). */
export function normalizeMobilitySignal(raw: RawMobilityRecord, opts: NormalizeOptions): MobilitySignal {
  const raw_identifiers_present = raw.has_raw_identifiers !== false; // fail-closed default: true
  const aggregation_floor_met =
    typeof raw.subject_count === "number" && raw.subject_count >= opts.min_subjects;
  const protected_location_excluded = raw.protected_location_excluded === true; // must be asserted

  let suppression_reason: string | null = null;
  if (raw_identifiers_present) suppression_reason = "raw identifiers present";
  else if (!aggregation_floor_met) suppression_reason = `below aggregation floor (min_subjects=${opts.min_subjects})`;
  else if (!protected_location_excluded) suppression_reason = "protected location not excluded";

  return {
    signal_id: raw.signal_id,
    signal_class: raw.signal_class ?? "observed_content",
    domain: raw.domain ?? "mobility",
    anchor: raw.anchor,
    time: raw.time,
    geo: { grain: raw.geo.grain, h3_resolution: raw.geo.h3_resolution ?? null },
    measures: raw.measures,
    provenance: {
      provider: raw.provider,
      source_contract_id: raw.source_contract_id,
      ingestion_activity_id: opts.ingestion_activity_id,
      baseline_id: opts.baseline_id,
    },
    privacy: {
      aggregation_floor_met,
      protected_location_excluded,
      raw_identifiers_present,
      suppression_reason,
    },
    license: { constraints: opts.license_constraints ?? [] },
    confidence: opts.confidence ?? { score: 0.5, method: "unspecified" },
  };
}
