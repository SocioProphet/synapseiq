# Warehouse Contract

This document defines the warehouse contract for **SynapseIQ**.

The warehouse is not just a sink. It is a versioned, semantically structured materialization layer that preserves:
- raw source fidelity
- normalized canonical structure
- enriched semantic outputs
- inferred findings
- downstream activation artifacts

## Goals

1. Preserve a strict separation between raw, staging, canonical, and mart layers
2. Prevent source-specific assumptions from leaking into cross-vendor analytical models
3. Support replay, audit, and re-derivation
4. Keep event, entity, link, mapping, finding, and activation families distinct

## Dataset families

### 1. Raw
Immutable landing layer with minimal transformation.

Recommended dataset name:
- `synapseiq_raw`

Properties:
- append-only
- short retention unless policy requires longer
- source-native payload preserved where allowed
- envelope preserved in full

Primary tables:
- `raw_records`
- `raw_dead_letter`
- `raw_ingest_audit`

### 2. Staging
Canonicalized but still pipeline-oriented layer.

Recommended dataset name:
- `synapseiq_stg`

Properties:
- deduped by `record_id`
- normalized UDM-aligned payloads
- field-level confidence retained
- provenance retained

Primary tables:
- `stg_events`
- `stg_entities`
- `stg_links`
- `stg_mappings`
- `stg_findings`
- `stg_activations`

### 3. Canonical
Cross-source semantic integration layer.

Recommended dataset name:
- `synapseiq_core`

Properties:
- entity consolidation
- relationship consolidation
- canonical business identifiers
- explanation references preserved

Primary tables:
- `core_events`
- `core_entities`
- `core_links`
- `core_mappings`
- `core_findings`

### 4. Mart
Consumer-oriented delivery layer.

Recommended dataset name:
- `synapseiq_mart`

Properties:
- domain-optimized views
- BI-friendly schemas
- activation-ready outputs
- no source-specific structural assumptions

Primary tables / views:
- `mart_account_intelligence`
- `mart_contact_intelligence`
- `mart_event_timeline`
- `mart_quality_summary`
- `mart_activation_exports`

## Table family contracts

## Raw record table

### `synapseiq_raw.raw_records`
Purpose: immutable landing of canonical envelopes.

Required columns:
- `record_id STRING`
- `envelope_version STRING`
- `record_kind STRING`
- `record_stage STRING`
- `record_ts TIMESTAMP`
- `source_id STRING`
- `source_type STRING`
- `source_record_id STRING`
- `transport_id STRING`
- `trace_id STRING`
- `correlation_id STRING`
- `classification STRING`
- `retention_class STRING`
- `overall_confidence FLOAT64`
- `canonical JSON`
- `source_native JSON`
- `explanations JSON`
- `errors JSON`
- `ingested_at TIMESTAMP`
- `processed_at TIMESTAMP`
- `processor STRING`
- `method STRING`

Partitioning:
- by `DATE(record_ts)`

Clustering:
- `source_id`, `record_kind`, `record_stage`

## Staging event table

### `synapseiq_stg.stg_events`
Purpose: event-only normalized records.

Required columns:
- `record_id STRING`
- `event_ts TIMESTAMP`
- `event_type STRING`
- `source_id STRING`
- `subject_entity_id STRING`
- `object_entity_id STRING`
- `location_entity_id STRING`
- `canonical_payload JSON`
- `confidence JSON`
- `provenance JSON`
- `explanation_ref STRING`

## Staging entity table

### `synapseiq_stg.stg_entities`
Purpose: normalized entity records before consolidation.

Required columns:
- `record_id STRING`
- `entity_id STRING`
- `entity_type STRING`
- `display_name STRING`
- `normalized_name STRING`
- `source_id STRING`
- `canonical_payload JSON`
- `confidence JSON`
- `provenance JSON`

## Staging link table

### `synapseiq_stg.stg_links`
Purpose: normalized relationship records.

Required columns:
- `record_id STRING`
- `link_id STRING`
- `link_type STRING`
- `from_entity_id STRING`
- `to_entity_id STRING`
- `source_id STRING`
- `confidence JSON`
- `provenance JSON`
- `canonical_payload JSON`

## Consolidation rules

### Event consolidation
Events are not merged by default. Events are deduplicated by `record_id` and may be semantically grouped in marts or specialized models.

### Entity consolidation
Entities may be consolidated into a canonical entity when matching criteria are met. Consolidation must preserve:
- source references
- confidence
- explanation lineage
- reversible merge evidence

### Link consolidation
Links may be consolidated if they represent the same semantic relationship across sources.

## Deduplication rules

1. `record_id` is the hard dedupe key for envelopes.
2. Source-level duplicate handling may use `source_id + source_record_id`.
3. Semantic dedupe for entities and links must preserve evidence and confidence.

## Retention rules

- Raw layer: short or policy-bound retention
- Staging layer: medium retention for replay and debugging
- Canonical and mart layers: longer retention, subject to policy

Retention classes are defined in the envelope policy block and must be enforced by infrastructure.

## Privacy rules

- Sensitive source-native payloads must remain in raw only when permitted.
- Staging and beyond should minimize unnecessary sensitive fields.
- Redactions must be traceable.

## Non-negotiable requirements

1. Warehouse contracts must not be vendor-specific.
2. Raw must be replayable.
3. Staging must remain canonical-envelope aligned.
4. Canonical and mart layers must preserve provenance references.
5. Confidence must not be discarded during consolidation.

## Rationale

This warehouse contract keeps SynapseIQ analytically powerful without sacrificing replay, provenance, privacy, or vendor independence.