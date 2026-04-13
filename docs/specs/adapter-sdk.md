# Adapter SDK Specification

This document defines the vendor adapter contract for **SynapseIQ**.

Adapters are the plugin boundary between source-native systems and the SynapseIQ canonical model.

## Purpose

An adapter must:
- ingest or receive source-native records
- normalize them into the canonical envelope
- optionally enrich them using source-specific or platform-wide logic
- emit records to the next stage in a deterministic, replayable way

Adapters must not:
- redefine canonical contracts
- embed warehouse-specific assumptions
- bypass policy enforcement
- hide confidence or provenance

## Adapter lifecycle

Each adapter implements the following lifecycle:

1. `describe()`
2. `validate_source()`
3. `ingest()`
4. `normalize()`
5. `enrich()`
6. `validate_output()`
7. `emit()`
8. `explain()`

## Required interface

```ts
export interface SynapseIQAdapter {
  describe(): AdapterDescriptor;
  validate_source(input: unknown): ValidationResult;
  ingest(input: unknown, ctx: AdapterContext): Promise<SourceRecord[]>;
  normalize(record: SourceRecord, ctx: AdapterContext): Promise<CanonicalEnvelope[]>;
  enrich(record: CanonicalEnvelope, ctx: AdapterContext): Promise<CanonicalEnvelope[]>;
  validate_output(record: CanonicalEnvelope, ctx: AdapterContext): ValidationResult;
  emit(record: CanonicalEnvelope, ctx: AdapterContext): Promise<EmitResult>;
  explain(record: CanonicalEnvelope, ctx: AdapterContext): Promise<Explanation[]>;
}
```

## Descriptor contract

```ts
export interface AdapterDescriptor {
  adapter_id: string;
  display_name: string;
  vendor: string;
  version: string;
  supported_source_types: string[];
  supported_record_kinds: string[];
  supported_delivery_modes: Array<"stream" | "batch" | "sync_api">;
  privacy_posture: string;
  capabilities: string[];
}
```

## Context contract

```ts
export interface AdapterContext {
  trace_id: string;
  correlation_id?: string;
  environment: "dev" | "staging" | "prod";
  policy_version?: string;
  feature_flags?: Record<string, boolean>;
  logger?: unknown;
  metrics?: unknown;
}
```

## Emission rules

Adapters may emit multiple canonical envelopes from one source record. Example:
- one `event`
- one `entity` for person
- one `entity` for organization
- one `link` between them

The adapter must preserve linkage via:
- `record_id`
- `source.source_record_id`
- shared `transport.correlation_id` when available

## Validation rules

### Source validation
Checks source-native shape, required source fields, and any vendor-specific invariants.

### Output validation
Checks canonical-envelope compliance, canonical payload compliance, policy compliance, and confidence/provenance completeness.

## Confidence and provenance requirements

If an adapter expands, maps, infers, or ranks anything, it must:
- set `provenance.method`
- emit field-level or overall confidence
- provide `explanations` or an `explanation_ref`

## Error semantics

Adapters must classify errors into:
- `fatal` — record cannot continue
- `retryable` — transient failure
- `partial` — some fields unavailable but record emitted
- `policy_blocked` — intentionally suppressed by policy

Errors must be emitted in structured form.

## Capability flags

Recommended descriptor capability flags:
- `supports_batch`
- `supports_stream`
- `supports_entity_extraction`
- `supports_glossary_mapping`
- `supports_ontology_alignment`
- `supports_confidence_scoring`
- `supports_explanations`
- `supports_human_feedback`

## Testing requirements

Every adapter must ship with:
- golden input fixtures
- golden normalized fixtures
- policy-blocked examples
- malformed input examples
- replay determinism tests

## Compatibility policy

Adapters may evolve independently, but they must not break the canonical envelope or the adapter interface without a versioned migration plan.

## Recommended initial adapters

- ZoomInfo / identity and firmographic enrichment
- GDELT / event graph enrichment
- ICEWS / geopolitical event enrichment
- EventRegistry / clustered event enrichment
- tabular metadata / glossary and semantic column mapping

## Rationale

The adapter SDK isolates source-specific volatility from the durable SynapseIQ product surface. This is how the platform scales across vendors without becoming a pile of bespoke glue code.