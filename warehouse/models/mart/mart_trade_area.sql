-- Retail trade-area mart (package retail_trade_area.v1)
-- Purpose: aggregate estimated visits into a per-anchor trade-area measure.
-- Fail-closed: ONLY signals whose computed suppression_reason is null contribute — the SQL analog
-- of the reasoning-layer suppression engine. A suppressed signal never reaches the aggregate.

select
  anchor_id,
  anchor_type,
  time_grain,
  count(*) as contributing_count,
  sum(cast(json_value(measures_json, '$.estimated_visits') as float64)) as total_estimated_visits
from {{ ref('stg_mobility_signals') }}
where suppression_reason is null            -- fail-closed: allowed signals only
  and signal_class = 'observed_content'
group by anchor_id, anchor_type, time_grain;
