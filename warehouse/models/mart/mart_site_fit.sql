-- Site-fit mart (site_fit.v1 output; consumed by retail/infrastructure siting wedges)
-- Purpose: aggregate a demand-weighted mean fit per candidate site.
-- Fail-closed: ONLY signals whose computed suppression_reason is null contribute. site_fit_score is
-- null (an unscored site, not a fabricated 0 that would read as "poor fit") when no allowed signal
-- carries positive demand weight — the SQL analog of the site-fit reasoning module.

with allowed as (
  select
    anchor_id as site_id,
    anchor_type,
    greatest(cast(json_value(measures_json, '$.demand_weight') as float64), 0.0) as demand_weight,
    least(greatest(cast(json_value(measures_json, '$.fit_score') as float64), 0.0), 1.0) as fit_score
  from {{ ref('stg_mobility_signals') }}
  where suppression_reason is null          -- fail-closed: allowed signals only
)
select
  site_id,
  anchor_type,
  count(*) as contributing_count,
  sum(demand_weight) as total_demand_weight,
  case when sum(demand_weight) > 0
       then sum(demand_weight * fit_score) / sum(demand_weight)
       else null end as site_fit_score
from allowed
group by site_id, anchor_type;
