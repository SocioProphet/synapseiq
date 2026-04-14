-- Staging links model stub
-- Purpose: normalize raw envelopes into link-family records while preserving provenance and confidence.

select
  cast(null as string) as record_id,
  cast(null as string) as link_id,
  cast(null as string) as link_type,
  cast(null as string) as from_entity_id,
  cast(null as string) as to_entity_id,
  cast(null as string) as source_id,
  cast(null as string) as canonical_payload_json,
  cast(null as string) as confidence_json,
  cast(null as string) as provenance_json
where 1 = 0;
