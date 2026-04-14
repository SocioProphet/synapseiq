-- Raw records model stub
-- Purpose: preserve append-only canonical envelopes and permitted source-native payloads.

select
  cast(null as string) as record_id,
  cast(null as string) as envelope_version,
  cast(null as string) as record_kind,
  cast(null as string) as record_stage,
  cast(null as timestamp) as record_ts,
  cast(null as string) as source_id,
  cast(null as string) as source_type,
  cast(null as string) as source_record_id,
  cast(null as string) as transport_id,
  cast(null as string) as trace_id,
  cast(null as string) as correlation_id,
  cast(null as string) as classification,
  cast(null as string) as retention_class,
  cast(null as float64) as overall_confidence,
  cast(null as string) as canonical_json,
  cast(null as string) as source_native_json,
  cast(null as string) as explanations_json,
  cast(null as string) as errors_json,
  cast(null as timestamp) as ingested_at,
  cast(null as timestamp) as processed_at,
  cast(null as string) as processor,
  cast(null as string) as method
where 1 = 0;
