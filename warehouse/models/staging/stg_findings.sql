-- Staging findings model stub
-- Purpose: normalize raw envelopes into finding-family records while preserving provenance and confidence.

select
  cast(null as string) as record_id,
  cast(null as string) as finding_type,
  cast(null as string) as decision,
  cast(null as string) as severity,
  cast(null as string) as canonical_payload_json,
  cast(null as string) as confidence_json,
  cast(null as string) as provenance_json
where 1 = 0;
