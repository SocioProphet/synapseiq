-- Raw-to-staging events transformation stub
-- Purpose: project canonical event envelopes from raw records into the staging events family.

select
  record_id,
  record_ts as event_ts,
  json_value(canonical_json, '$.event_type') as event_type,
  source_id,
  json_value(canonical_json, '$.subject_entity_id') as subject_entity_id,
  json_value(canonical_json, '$.object_entity_id') as object_entity_id,
  json_value(canonical_json, '$.location_entity_id') as location_entity_id,
  canonical_json as canonical_payload_json,
  cast(json_object('overall', overall_confidence) as string) as confidence_json,
  cast(
    json_object(
      'processor', processor,
      'method', method,
      'ingested_at', ingested_at,
      'processed_at', processed_at
    ) as string
  ) as provenance_json,
  null as explanation_ref
from {{ ref('raw_records') }}
where record_kind = 'event';
