-- Staging events model stub
-- Purpose: normalize raw envelopes into event-family records while preserving provenance and confidence.

select
  cast(null as string) as record_id,
  cast(null as timestamp) as event_ts,
  cast(null as string) as event_type,
  cast(null as string) as source_id,
  cast(null as string) as subject_entity_id,
  cast(null as string) as object_entity_id,
  cast(null as string) as location_entity_id,
  cast(null as string) as canonical_payload_json,
  cast(null as string) as confidence_json,
  cast(null as string) as provenance_json,
  cast(null as string) as explanation_ref
where 1 = 0;
