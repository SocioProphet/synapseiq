-- Event-impact / demand-lift mart (package event_impact.v1)
-- Purpose: aggregate baseline vs observed visits per anchor into a lift measure.
-- Fail-closed: ONLY signals whose computed suppression_reason is null contribute. lift_ratio is
-- null (not a divide-by-zero, not a fabricated number) when the allowed baseline is 0 — the SQL
-- analog of the event-lift reasoning module's null-baseline handling.

with allowed as (
  select
    anchor_id,
    anchor_type,
    time_grain,
    cast(json_value(measures_json, '$.baseline_visits') as float64) as baseline_visits,
    cast(json_value(measures_json, '$.observed_visits') as float64) as observed_visits
  from {{ ref('stg_mobility_signals') }}
  where suppression_reason is null          -- fail-closed: allowed signals only
)
select
  anchor_id,
  anchor_type,
  time_grain,
  count(*) as contributing_count,
  sum(baseline_visits) as baseline_visits,
  sum(observed_visits) as observed_visits,
  sum(observed_visits) - sum(baseline_visits) as lift,
  case when sum(baseline_visits) > 0
       then sum(observed_visits) / sum(baseline_visits)
       else null end as lift_ratio
from allowed
group by anchor_id, anchor_type, time_grain;
