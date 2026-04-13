# Capability Surface

This document defines the durable product capability surface for **SynapseIQ**.

The capability surface is designed to be:
- vendor-agnostic
- semantically explicit
- automation-friendly
- explainable
- composable across stream, batch, and interactive use cases

## Core capability families

## 1. Ingestion

SynapseIQ must ingest from:
- APIs and webhooks
- event buses such as Kafka and Pub/Sub
- tabular lakes and warehouse exports
- semi-structured documents and metadata catalogs
- vendor-native exports and feeds

Capabilities:
- streaming ingestion
- batch ingestion
- replay and reprocessing
- source registration
- provenance capture
- idempotent receipt handling

## 2. Normalization

Incoming vendor records are transformed into canonical envelopes.

Capabilities:
- field normalization
- identifier normalization
- timestamp normalization
- coded-name expansion
- schema drift handling
- confidence capture for uncertain expansions

## 3. Semantic Enrichment

Capabilities:
- business glossary mapping
- ontology alignment
- concept linking
- semantic labeling and classification
- semantic similarity ranking
- multi-vendor enrichment composition
- quality scoring and explanation generation

## 4. Reasoning and Inference

Capabilities:
- rule-based inference
- ontology-driven inference
- link discovery
- confidence propagation
- explanation traces
- ranking and prioritization
- semantic search over canonical entities and events

## 5. Quality and Governance

Capabilities:
- schema validation
- semantic validation
- policy enforcement
- provenance and lineage
- record-level evidence trails
- redaction and minimization
- retention controls

## 6. Activation and Serving

Capabilities:
- warehouse materialization
- API delivery
- downstream event emission
- martech activation
- search and QA surfaces
- analyst-oriented exports
- developer-facing grammar and LSP tooling

## Vendor-facing capability surface

Each vendor adapter must expose a common interface:
- `ingest()`
- `normalize()`
- `enrich()`
- `explain()`
- `emit()`
- `validate()`

Each adapter should also declare:
- supported record types
- supported delivery modes
- semantic confidence characteristics
- privacy posture
- failure/retry behavior
- version compatibility

## Developer-facing capability surface

SynapseIQ should provide developer-native surfaces for:
- typed contracts
- parser grammars
- tree-sitter-based syntax tooling
- LSP services for mappings and contract authoring
- local replay harnesses
- fixture-driven adapter development

## Data-facing capability surface

SynapseIQ should provide canonical outputs for:
- raw events
- normalized events
- enriched events
- linked entities
- glossary mappings
- reasoning findings
- quality findings
- activation outputs

## Analyst-facing capability surface

SynapseIQ should enable:
- explainable concept discovery
- semantic search
- entity-centric and event-centric exploration
- cross-source correlation
- ranking with evidence

## Long-range capability extensions

The architecture should preserve room for:
- human-in-the-loop feedback
- reinforcement and reward-driven ranking improvements
- formal methods and proof-carrying contracts
- Agda/typed logic integration
- code and metadata recommendation
- cross-domain digital twin modeling

## Capability maturity model

### Phase 1
- stable contracts
- canonical envelope
- initial adapters
- raw/staging warehouse models

### Phase 2
- ontology alignment and glossary mapping
- reasoning and explanation APIs
- quality and governance passes

### Phase 3
- grammar/LSP surfaces
- advanced ranking and HIL feedback
- broad downstream activation

### Phase 4
- formal verification hooks
- domain-specialized reasoning packs
- world-class product-grade operator and developer surfaces
