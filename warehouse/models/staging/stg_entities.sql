-- Staging entities model stub
-- Purpose: normalize raw envelopes into entity-family records while preserving provenance and confidence.

select
  cast(null as string) as record_id,
  cast(null as string) as entity_id,
  cast(null as string) as entity_type,
  cast(null as string) as display_name,
  cast(null as string) as normalized_name,
  cast(null as string) as source_id,
  cast(null as string) as canonical_payload_json,
  cast(null as string) as confidence_json,
  cast(null as string) as provenance_json
where 1 = 0;
