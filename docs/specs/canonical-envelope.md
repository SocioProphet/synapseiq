# Canonical Enrichment Envelope

This document defines the universal record envelope for **SynapseIQ**.

The canonical envelope is the stable outer contract for all records moving through the platform, regardless of:
- source vendor
- transport mechanism
- domain ontology
- processing stage
- downstream consumer

The purpose of the envelope is to make all records:
- traceable
- replayable
- explainable
- typed
- policy-aware
- versioned

## Design goals

1. Separate transport metadata from semantic payload
2. Preserve source-native data without letting it leak into the canonical model
3. Capture provenance, confidence, and policy posture as first-class fields
4. Support both streaming and batch execution
5. Support raw, normalized, enriched, and inferred records with one family of envelopes

## Envelope shape

```json
{
  "envelope_version": "1.0.0",
  "record_kind": "event|entity|link|mapping|finding|activation",
  "record_stage": "raw|normalized|enriched|validated|inferred|activated",
  "record_id": "uuidv7",
  "record_ts": "2026-04-13T02:00:00.000Z",
  "source": {
    "source_id": "zoominfo-websights",
    "source_type": "vendor_api|webhook|stream|file|warehouse|document",
    "source_record_id": "vendor-native-id-or-null",
    "source_url": "optional",
    "source_version": "optional"
  },
  "transport": {
    "transport_id": "kafka|pubsub|http|batch",
    "topic": "optional",
    "partition": "optional",
    "offset": "optional",
    "trace_id": "optional",
    "correlation_id": "optional"
  },
  "policy": {
    "policy_version": "optional",
    "consent_mode": "basic|advanced|none|unknown",
    "classification": "public|internal|confidential|restricted",
    "redactions_applied": [],
    "retention_class": "raw-short|staging-medium|curated-long"
  },
  "provenance": {
    "ingested_at": "timestamp",
    "processed_at": "timestamp",
    "processor": "adapter-or-service-name",
    "method": "rule|model|hybrid|manual",
    "lineage": []
  },
  "confidence": {
    "overall": 0.0,
    "field_confidence": {},
    "explanation_ref": "optional"
  },
  "canonical": {},
  "source_native": {},
  "explanations": [],
  "errors": []
}
```

## Field semantics

### `envelope_version`
Version of the envelope contract. This is independent of any vendor schema version.

### `record_kind`
Top-level business shape. Valid values:
- `event`
- `entity`
- `link`
- `mapping`
- `finding`
- `activation`

### `record_stage`
Pipeline stage at which the record was emitted:
- `raw`
- `normalized`
- `enriched`
- `validated`
- `inferred`
- `activated`

### `record_id`
Globally unique identifier assigned by SynapseIQ.

### `source`
Identifies the originating system and source-native record identity.

### `transport`
Captures delivery-layer evidence for replay and operational debugging.

### `policy`
Captures consent, sensitivity classification, redactions, and retention posture.

### `provenance`
Captures how the record was produced.

### `confidence`
Captures model or rule confidence. All confidence is explicit. Confidence must never be implied.

### `canonical`
The canonical payload aligned to UDM and applicable domain ontologies.

### `source_native`
Raw or near-raw source payload, optionally redacted.

### `explanations`
Structured explanation references describing how the canonical payload or findings were produced.

### `errors`
Structured non-fatal processing errors and warnings.

## Canonical payload families

The `canonical` object shape depends on `record_kind`.

### Event payload
Used for observed actions, visits, transactions, incidents, detections, and other time-bound occurrences.

### Entity payload
Used for people, organizations, assets, products, accounts, devices, documents, and other durable nodes.

### Link payload
Used for semantic edges such as membership, ownership, participation, co-occurrence, similarity, or inferred relations.

### Mapping payload
Used for glossary mappings, ontology alignments, field mappings, and concept associations.

### Finding payload
Used for quality findings, rule hits, policy violations, inferred risks, or analyst-support results.

### Activation payload
Used for downstream outputs into martech, CRM, security, workflow, or analyst systems.

## Non-negotiable requirements

1. Every emitted record must have a `record_id`.
2. Every emitted record must carry `source.source_id`.
3. Every emitted record must carry `provenance.processor` and `provenance.method`.
4. Any model-derived or heuristic field must have explicit confidence attached.
5. `source_native` may be absent only when prohibited by policy or unavailable from source.
6. Envelope fields must never be overloaded with vendor-specific semantics.

## Rationale

The envelope is the durable contract that lets SynapseIQ support many vendors, many domains, and many downstream consumers without redesigning the pipeline per source.