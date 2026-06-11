# Mobility Content and Enrichment Specification

Status: Draft v0.1
Owner: SynapseIQ
Date: 2026-06-03

## 1. Purpose

This specification defines the first SynapseIQ mobility-content product lane. The lane converts observed physical-world and economic-flow content into governed enrichment packages.

The lane is not a reference-data catalog. It uses reference data as the join fabric, but the product value comes from content-derived packages with lineage, confidence, permitted-use constraints, privacy screening, and explanations.

## 2. Core distinction

```text
Reference substrate:
  POIs, roads, parcels, administrative boundaries, H3 cells, census geographies,
  GTFS stops, NAICS, brands, chains.

Observed content:
  visits, trips, dwell, speed, congestion, origin-destination flows, spend,
  transactions, events, weather, parking, freight movement, construction,
  search demand, web/app behavior.

Derived enrichment:
  trade areas, visit lift, leakage, cannibalization, trip-purpose scores,
  demand pressure, competitor overlap, corridor exposure, EV siting score,
  event impact, supply-chain stress.

Product package:
  a governed bundle of enrichment outputs, source lineage, confidence,
  permitted use, geography, time grain, suppression logic, and explanation.
```

## 3. Content lanes

### 3.1 Place and footfall content

Observed content includes venue visitation, dwell, repeat rate, visitor-origin mix, trade-area draw, cross-shopping, category adjacency, competitive leakage, daypart behavior, and temporal lift.

Candidate provider classes include footfall panels, place-intelligence providers, SDK-consented mobility aggregators, and venue analytics platforms.

### 3.2 Road, corridor, and vehicle movement content

Observed content includes traffic volume, speed, congestion, pass-by exposure, truck movement, origin-destination matrices, dwell and idling zones, vehicle class, route choice, and temporal road demand.

Candidate provider classes include connected-vehicle data providers, transportation-analytics platforms, logistics mobility providers, and realtime/historical traffic providers.

### 3.3 Spend, transaction, and commercial-value content

Observed content includes merchant/category spend, sales proxy, repeat purchase, customer migration, category share, and pre/post campaign or event lift.

This lane is required because movement does not always equal value. Package outputs should distinguish footfall volume from commercial-quality demand.

### 3.4 Intent and attention content

Observed content includes search demand, review velocity, web/app behavior, brand interest, local discovery behavior, social/event chatter, and merchant listing changes.

This lane provides leading indicators before physical movement changes.

### 3.5 Event, weather, disruption, and civic content

Observed content includes events, road closures, construction, 311 reports, weather, air quality, school calendars, holidays, sports schedules, strikes, and disaster feeds.

This lane explains anomalies and supports event-adjusted baseline logic.

### 3.6 Freight, supply-chain, and asset-flow content

Observed content includes truck spot-market data, port calls, AIS/marine movement, rail intermodal, warehouse occupancy, customs/import-export records, supplier locations, delivery zones, and logistics constraints.

This lane extends traffic intelligence into economic-flow intelligence.

## 4. Initial product packages

### 4.1 Retail Trade Area Intelligence

Inputs:

- POI identity;
- footfall or visitation;
- visitor-origin mix;
- dwell time;
- repeat rate;
- cross-shopping;
- competitive set;
- event context;
- Census/LODES context;
- optional spend aggregate.

Outputs:

- true trade area;
- visit trend;
- visitor mix;
- daypart profile;
- repeat-visit score;
- competitive overlap;
- leakage or capture score;
- cannibalization risk;
- event-adjusted demand;
- site-fit score;
- confidence band.

Primary buyers: retail, restaurants, CPG, CRE, local economic development, finance.

### 4.2 CRE Location Underwriting

Inputs:

- footfall;
- road exposure;
- POI adjacency;
- tenant mix;
- worker/resident split;
- event pressure;
- visit trend;
- category demand;
- competitive saturation.

Outputs:

- location quality score;
- tenant-fit score;
- corridor exposure;
- daytime population proxy;
- destination strength;
- demand volatility;
- vacancy-risk signal;
- redevelopment uplift proxy.

### 4.3 Corridor and Traffic Exposure

Inputs:

- road graph;
- traffic volumes;
- connected vehicle movement;
- truck activity;
- congestion;
- speed;
- dwell and stop zones;
- events, closures, and weather;
- public traffic calibration.

Outputs:

- corridor demand index;
- pass-by exposure;
- truck pressure;
- congestion burden;
- freight relevance;
- time-of-day profile;
- weekday/weekend split;
- disruption adjustment;
- confidence band.

### 4.4 EV, Fuel, and Logistics Siting

Inputs:

- vehicle pass-by;
- truck pass-by;
- dwell-compatible locations;
- origin-destination patterns;
- fuel-type segmentation where licensed;
- nearby POIs;
- grid and site context;
- competitor stations;
- logistics nodes.

Outputs:

- charger demand score;
- fuel demand score;
- fleet suitability;
- truck dwell opportunity;
- underserved corridor score;
- commuter/visitor split;
- local versus long-haul split;
- site rank.

### 4.5 Event Impact and Demand Lift

Inputs:

- event calendar;
- venue POIs;
- footfall;
- road/transit context;
- weather;
- hotel, restaurant, and retail adjacency;
- historical baseline.

Outputs:

- pre-event lift;
- post-event decay;
- ingress/egress pressure;
- nearby merchant impact;
- parking stress;
- transit load proxy;
- staffing/inventory demand signal.

### 4.6 Aggregate Offline Attribution

Inputs:

- campaign geography;
- campaign timing;
- store/venue visits;
- control areas;
- event/weather controls;
- competitive movement;
- privacy thresholds.

Outputs:

- visit lift;
- incremental visits;
- exposed-area response;
- competitor deflection;
- event-adjusted baseline;
- confidence interval;
- suppression report.

## 5. Privacy and permitted-use requirements

### 5.1 Allowed data classes

- aggregated visits;
- aggregated vehicle movement;
- aggregated origin-destination flows;
- aggregated trade-area composition;
- aggregated event lift;
- aggregated spend bands;
- derived scores with suppression.

### 5.2 Blocked data classes

- raw device identifiers;
- individual device trails;
- household-level movement profiles;
- sensitive-place audiences;
- healthcare, worship, protest, shelter, military, addiction-treatment, immigration, or comparable sensitive-place targeting;
- bidstream-derived location data without explicit consent provenance and contract review;
- resale of raw provider feeds unless explicitly licensed;
- law-enforcement use without a separate legal and governance lane.

## 6. Canonical signal object

The canonical object is an observed signal with governance metadata.

Required conceptual fields:

- `signal_id`;
- `signal_class`;
- `domain`;
- anchor type and ID;
- time grain and window;
- geography grain and optional H3 resolution;
- measures;
- provenance;
- provider;
- source contract ID;
- ingestion activity ID;
- baseline ID;
- privacy flags;
- suppression reason;
- license constraints;
- allowed packages;
- confidence score and method.

## 7. Package manifest

Each sellable package must have a package manifest before it is exposed through APIs or customer workflows.

A package manifest declares:

- package ID and version;
- title;
- purpose;
- allowed uses;
- blocked uses;
- required inputs;
- optional inputs;
- outputs;
- minimum aggregation requirements;
- sensitive-place suppression behavior;
- confidence strategy;
- lineage requirements.

## 8. Data Source Contract

Every provider requires a Data Source Contract before ingestion.

The contract must identify:

- source ID;
- provider;
- source class;
- content lane;
- raw data class;
- delivery mode;
- supported formats;
- refresh cadence;
- supported geography grains;
- supported time grains;
- raw identifier policy;
- aggregation-floor requirement;
- sensitive-place exclusion requirement;
- derived-enrichment permission;
- raw-resale permission or prohibition;
- customer-data join permission;
- AI-training permission or prohibition;
- contract review status;
- privacy review status;
- package approval status;
- required UCM activity.

## 9. ADS-shaped event substrate

Implementation should use an event-driven ingestion substrate:

```text
Provider feed
  -> Data Source Contract
  -> privacy/license/permitted-use gate
  -> raw landing zone
  -> normalizer
  -> canonical observed-content event
  -> enrichment compiler
  -> suppression / aggregation / confidence pass
  -> package output
  -> lineage and evidence bundle
```

The initial implementation may run in-memory and fixture-based. Kafka, graph, vector, object, and warehouse projections are downstream implementation details that must preserve deterministic event IDs, idempotency, DLQ behavior, and cross-layer references.

## 10. First build wedge

The first build wedge is:

1. Retail Trade Area Intelligence.
2. EV / Logistics Corridor Intelligence.

The wedge proves that the same contracts, privacy gates, signal model, package manifest, confidence strategy, and lineage system can support both venue-centric and corridor-centric products.
