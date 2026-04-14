-- Staging mappings model stub
-- Purpose: normalize raw envelopes into mapping-family records while preserving provenance and confidence.

select
  cast(null as string) as record_id,
  cast(null as string) as mapping_type,
  cast(null as string) as target,
  cast(null as string) as source_fields_json,
  cast(null as string) as canonical_payload_json,
  cast(null as string) as confidence_json,
  cast(null as string) as provenance_json
where 1 = 0;
