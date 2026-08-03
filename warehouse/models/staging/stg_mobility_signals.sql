-- Staging mobility-signals model stub
-- Purpose: normalize raw envelopes carrying mobility-signal.v1 into a staging table, preserving the
-- COMPUTED privacy gates so every downstream mart can enforce fail-closed suppression in SQL.
--
-- The privacy gates are the same ones the normalizer computes (aggregation_floor_met /
-- protected_location_excluded / raw_identifiers_present) plus the first-failing suppression_reason.
-- A signal is ALLOWed for a mart only when suppression_reason is null — marts MUST filter on it.

select
  cast(null as string) as signal_id,
  cast(null as string) as signal_class,              -- observed_content | reference_substrate | derived_enrichment
  cast(null as string) as domain,
  cast(null as string) as anchor_type,
  cast(null as string) as anchor_id,
  cast(null as string) as time_grain,
  cast(null as timestamp) as time_start,
  cast(null as timestamp) as time_end,
  cast(null as string) as geo_grain,
  cast(null as int64) as h3_resolution,
  cast(null as string) as measures_json,
  cast(null as string) as provider,
  cast(null as string) as source_contract_id,
  cast(null as string) as ingestion_activity_id,
  cast(null as string) as baseline_id,
  -- computed privacy gates (never provider claims)
  cast(null as bool) as aggregation_floor_met,
  cast(null as bool) as protected_location_excluded,
  cast(null as bool) as raw_identifiers_present,
  cast(null as string) as suppression_reason,        -- null => ALLOWed; non-null => suppressed
  cast(null as float64) as confidence_score,
  cast(null as string) as confidence_method,
  cast(null as string) as explanation_ref
where 1 = 0;
