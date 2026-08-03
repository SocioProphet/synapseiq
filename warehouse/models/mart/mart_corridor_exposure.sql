-- Corridor traffic-exposure mart (package corridor_traffic_exposure.v1)
-- Purpose: aggregate estimated passages per corridor segment into an exposure measure.
-- Fail-closed: ONLY signals whose computed suppression_reason is null contribute. A fully-suppressed
-- segment simply does not appear (no zero-filled row), mirroring the reasoning-layer per_segment.

select
  json_value(measures_json, '$.segment_id') as segment_id,
  time_grain,
  count(*) as contributing_count,
  sum(cast(json_value(measures_json, '$.estimated_passages') as float64)) as total_estimated_passages
from {{ ref('stg_mobility_signals') }}
where suppression_reason is null            -- fail-closed: allowed signals only
group by json_value(measures_json, '$.segment_id'), time_grain;
