-- Raw-to-staging entities transformation stub
-- Purpose: project canonical entity envelopes from raw records into the staging entities family.

select
  record_id,
  json_value(canonical_json, '$.attributes.entity_id') as entity_id,
  json_value(canonical_json, '$.entity_type') as entity_type,
  json_value(canonical_json, '$.display_name') as display_name,
  json_value(canonical_json, '$.normalized_name') as normalized_name,
  source_id,
  canonical_json as canonical_payload_json,
  cast(json_object('overall', overall_confidence) as string) as confidence_json,
  cast(
    json_object(
      'processor', processor,
      'method', method,
      'ingested_at', ingested_at,
      'processed_at', processed_at
    ) as string
  ) as provenance_json
from {{ ref('raw_records') }}
where record_kind = 'entity';
