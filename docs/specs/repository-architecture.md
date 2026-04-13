# Repository Architecture

This document defines the repository shape for **SynapseIQ** and the intent of each major package, service, and documentation lane.

## Architectural stance

SynapseIQ is a **product platform**, not a one-off connector and not a single-vendor tool.

The repository is organized around five durable layers:

1. **Contracts** — schemas, canonical envelopes, interface definitions, policy surfaces
2. **Semantics** — ontologies, glossary mapping, UDM alignment, reasoning rules
3. **Pipelines** — ingestion, normalization, enrichment, validation, activation
4. **Serving** — APIs, query surfaces, search, LSP and grammar interfaces
5. **Operations** — infrastructure, monitoring, security, CI/CD, release controls

## Top-level structure

```text
synapseiq/
├── packages/
│   ├── schemas/
│   ├── contracts/
│   ├── ontology/
│   ├── normalization/
│   ├── transformation/
│   ├── enrichment/
│   ├── reasoning/
│   ├── grammars/
│   ├── lsp/
│   └── utils/
├── services/
│   ├── enrichment-api/
│   ├── enrichment-collector/
│   ├── reasoning-api/
│   └── control-plane/
├── warehouse/
│   ├── models/
│   ├── views/
│   └── tests/
├── infra/
│   ├── cloud-run/
│   ├── pubsub/
│   ├── bigquery/
│   ├── iam/
│   └── monitoring/
├── docs/
│   ├── specs/
│   ├── adr/
│   ├── privacy/
│   ├── vendors/
│   └── use-cases/
└── tests/
    ├── contract/
    ├── integration/
    └── performance/
```

## Package responsibilities

### `packages/schemas/`
Versioned JSON Schema, Avro, and typed runtime validation models for canonical records, requests, responses, and envelopes.

### `packages/contracts/`
SDK-facing interfaces for adapters, providers, matchers, enrichers, resolvers, quality gates, and activators.

### `packages/ontology/`
UDM-aligned canonical semantic layer and supporting domain ontologies. This is where gist mappings, FIBO/UCO/SCO alignments, glossary bridges, and ontology metadata live.

### `packages/normalization/`
Transforms vendor-native payloads into canonical event and entity forms.

### `packages/transformation/`
Higher-level record reshaping across stream, batch, warehouse, and serving surfaces.

### `packages/enrichment/`
Vendor adapters and enrichment operators. This package is intentionally modular so that each vendor or provider can be added without disturbing the core contracts.

### `packages/reasoning/`
Inference rules, semantic joins, ranking logic, quality rules, confidence propagation, and explanation generation.

### `packages/grammars/`
Tree-sitter grammars and other parser definitions for query DSLs, mapping grammars, schema notation, and semantic transformation syntax.

### `packages/lsp/`
Language Server Protocol implementation for SynapseIQ grammars, contracts, mappings, and ontology-linked authoring surfaces.

### `packages/utils/`
Cross-cutting libraries: IDs, clocks, retries, logging, metrics, provenance helpers, and common type utilities.

## Service responsibilities

### `services/enrichment-api/`
External ingress surface for synchronous requests, webhooks, and integration callbacks.

### `services/enrichment-collector/`
Asynchronous stream and batch ingress processor responsible for normalization, validation, and routing into Kafka/PubSub and raw storage.

### `services/reasoning-api/`
Higher-order semantic query and reasoning surface for ranking, linking, explanation, and inferred relationships.

### `services/control-plane/`
Configuration, policies, model registration, adapter registration, feature flags, and governance controls.

## Warehouse responsibilities

### `warehouse/models/`
Canonical raw/staging/mart contracts for event data, entity data, semantic links, quality findings, and activation outputs.

### `warehouse/views/`
Curated analyst and product views optimized for search, BI, QA, martech activation, and downstream systems.

### `warehouse/tests/`
Warehouse-level contract assertions, quality tests, and model regression checks.

## Infrastructure responsibilities

### `infra/cloud-run/`
Runtime definitions for synchronous APIs and collectors.

### `infra/pubsub/`
Topic/subscription definitions and event-routing topology.

### `infra/bigquery/`
Dataset, table, retention, partitioning, and access definitions.

### `infra/iam/`
Least-privilege role and service-account bindings.

### `infra/monitoring/`
Dashboards, alerts, SLOs, tracing, and error-budget posture.

## Documentation responsibilities

### `docs/specs/`
Normative system specs.

### `docs/adr/`
Architectural Decision Records documenting tradeoffs and durable decisions.

### `docs/privacy/`
Consent, minimization, retention, and policy posture.

### `docs/vendors/`
Vendor-specific behavior, contracts, limits, and adapter notes.

### `docs/use-cases/`
Domain-specific application patterns across martech, analytics, security, law enforcement, finance, supply chain, and defense.

## Test strategy

- `tests/contract/` for schema and interface enforcement
- `tests/integration/` for end-to-end adapter and pipeline checks
- `tests/performance/` for throughput, latency, and quality scaling benchmarks

## Build order

1. Freeze contracts and canonical model
2. Add adapter SDK interfaces
3. Add first-party collector and warehouse raw contracts
4. Add vendor adapters
5. Add reasoning and explanation passes
6. Add grammar/LSP surfaces
7. Add control-plane and governance layer

## Non-goals for the initial tranche

- full UI product surface
- every vendor implementation at once
- deep model training before interfaces stabilize

The initial tranche is focused on creating a stable capability substrate that can absorb multiple vendors and multiple vertical use cases without redesign.