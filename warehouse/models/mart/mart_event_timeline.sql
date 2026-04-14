-- Event timeline mart stub
-- Purpose: expose consumer-friendly event chronology from staging events.

select
  record_id,
  event_ts,
  event_type,
  source_id,
  subject_entity_id,
  object_entity_id,
  location_entity_id,
  json_value(canonical_payload_json, '$.attributes.page_url') as page_url,
  explanation_ref
from {{ ref('stg_events') }}
where 1 = 1;
