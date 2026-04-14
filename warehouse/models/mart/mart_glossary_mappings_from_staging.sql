-- Glossary mappings transformation stub
-- Purpose: project staging mapping records into a consumer-friendly mart.

select
  record_id,
  json_value(canonical_payload_json, '$.source_fields[0]') as table_name,
  json_value(canonical_payload_json, '$.source_fields[1]') as column_name,
  json_value(canonical_payload_json, '$.target') as mapping_target,
  cast(json_value(confidence_json, '$.overall') as float64) as overall_confidence,
  json_value(canonical_payload_json, '$.attributes.column_description') as column_description
from {{ ref('stg_mappings') }}
where 1 = 1;
