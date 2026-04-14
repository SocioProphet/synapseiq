-- Entity directory mart stub
-- Purpose: expose consumer-friendly entities from staging entities.

select
  record_id,
  entity_id,
  entity_type,
  display_name,
  normalized_name,
  source_id,
  json_value(canonical_payload_json, '$.attributes.company_domain') as company_domain
from {{ ref('stg_entities') }}
where 1 = 1;
