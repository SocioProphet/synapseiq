-- Raw-to-staging findings transformation stub

select
  record_id,
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
where record_kind = 'finding';
