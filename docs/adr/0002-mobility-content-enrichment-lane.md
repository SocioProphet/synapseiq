# ADR-0002: Mobility Content and Enrichment Product Lane

Status: Accepted
Date: 2026-06-03

## Context

SynapseIQ is intended to be a semantic enrichment and intelligence fabric rather than a single-vendor connector or a fixed data pipeline. The next product lane is mobility content and traffic-based enrichment: observed behavioral content transformed into governed, purpose-bound product packages.

The strategic correction is that standards and reference data are not the sellable product. They are the join fabric. The product is observed content plus derived enrichment with provenance, confidence, privacy screening, permitted-use metadata, and package-level explanation.

## Decision

Create a first-class SynapseIQ Mobility Content and Enrichment lane.

This lane is responsible for:

- separating reference substrate from observed content and derived enrichment;
- defining provider data-source contracts before ingestion;
- defining canonical mobility signal envelopes;
- defining package manifests for sellable enrichment products;
- enforcing permitted-use, sensitive-place, and aggregation policies;
- producing lineage and confidence evidence for each package output;
- preserving provider replaceability by using synthetic fixtures before vendor-specific adapters.

## Taxonomy

Reference substrate includes POIs, roads, parcels, administrative boundaries, H3 cells, census geographies, GTFS stops, NAICS, brands, and chains.

Observed content includes visits, trips, dwell, speed, congestion, origin-destination flows, spend, transactions, events, weather, parking, freight movement, construction, search demand, and web/app behavior.

Derived enrichment includes trade areas, visit lift, leakage, cannibalization, trip-purpose scores, demand pressure, competitor overlap, corridor exposure, EV siting scores, event impact, and supply-chain stress.

Product packages are governed bundles of enrichment outputs, source lineage, confidence, permitted use, geography, time grain, suppression logic, and explanation.

## Initial packages

The first two packages are:

1. Retail Trade Area Intelligence.
2. EV / Logistics Corridor Intelligence.

They are deliberately different. Retail Trade Area Intelligence forces venue, POI, footfall, dwell, origin-mix, event, and competitive-overlap mechanics. EV / Logistics Corridor Intelligence forces roads, corridor exposure, vehicle movement, truck pressure, dwell-compatible sites, and infrastructure-demand mechanics.

## Privacy and permitted-use posture

Allowed classes:

- aggregated visits;
- aggregated vehicle movement;
- aggregated origin-destination flows;
- aggregated trade-area composition;
- aggregated event lift;
- aggregated spend bands;
- derived scores with suppression.

Blocked classes:

- raw device identifiers;
- individual device trails;
- household-level movement profiles;
- sensitive-place audiences;
- healthcare, worship, protest, shelter, military, addiction-treatment, immigration, or comparable sensitive-place targeting;
- bidstream-derived location data without explicit consent provenance and contract review;
- resale of raw provider feeds unless explicitly licensed;
- law-enforcement use without a separate legal and governance lane.

## Repository placement

The canonical product lane lives in this repository because SynapseIQ owns semantic enrichment contracts, normalization, ontology alignment, reasoning, package outputs, and policy gates.

Cross-repo projections are downstream:

- `prophet-platform` hosts runtime/demo API surfaces and GAIA/OSM map overlays.
- `sociosphere` registers product-readiness and capability metadata.
- `sherlock-search` indexes package evidence, lineage, and explainable search fixtures.

## Implementation sequence

1. Land doctrine, package definitions, and provider-onboarding requirements.
2. Add contract schemas and example fixtures.
3. Add semantic taxonomies and sensitive-place policy.
4. Add synthetic provider raw events and normalizers.
5. Add package compilers and deterministic confidence/suppression logic.
6. Add package-manifest DSL/LSP alignment.
7. Register the lane in platform, Sociosphere, and Sherlock.
8. Add end-to-end evidence fixtures.

## Non-goals

- No immediate vendor-specific Placer, StreetLight, Foursquare, PredictHQ, INRIX, HERE, TomTom, Mastercard, or Visa adapter.
- No raw device graph.
- No individual-level targeting surface.
- No sensitive-place audience construction.
- No package without a Data Source Contract and Package Manifest.

## Consequences

SynapseIQ becomes a governed enrichment compiler rather than a generic data lake. Providers are inputs, not architecture. Commercial value sits in package-level semantics, confidence, lineage, and permitted use.