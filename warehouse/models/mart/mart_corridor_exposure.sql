-- Corridor traffic-exposure mart (package corridor_traffic_exposure.v1)
-- Purpose: aggregate estimated passages per corridor segment into an exposure measure.
-- Fail-closed: ONLY signals whose computed suppression_reason is null contribute. A fully-suppressed
-- segment simply does not appear (no zero-filled row), mirroring the reasoning-layer per_segment.
--
-- Corridor signals anchor ON the segment, so the segment is the staging anchor_id (a real staging
-- column) — not a field inside measures_json. Grouping on anchor_id keeps the mart consistent with
-- both the staging model and the FHWA HPMS baseline adapter (anchor_type='road_segment').

select
  anchor_id as segment_id,
  anchor_type,
  time_grain,
  count(*) as contributing_count,
  sum(cast(json_value(measures_json, '$.estimated_passages') as float64)) as total_estimated_passages
from {{ ref('stg_mobility_signals') }}
where suppression_reason is null            -- fail-closed: allowed signals only
group by anchor_id, anchor_type, time_grain;
