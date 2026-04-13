# Provenance and Confidence Specification

This document defines how **SynapseIQ** represents provenance, confidence, lineage, reviewer status, and merge semantics.

These fields are not optional product decoration. They are core to:
- explainability
- auditability
- replayability
- human trust
- downstream policy enforcement

## Goals

1. Every derived value must be attributable to a method and source.
2. Every non-deterministic or heuristic result must carry explicit confidence.
3. Confidence must be preserved through transformations and merges.
4. Human review must be representable without overwriting machine evidence.
5. Provenance must support replay, debugging, and policy inspection.

## Provenance model

Provenance is attached at two levels:
- record level
- field level

## Record-level provenance

Record-level provenance answers:
- where did this record come from?
- what process produced it?
- when was it produced?
- what other records contributed to it?

Recommended record-level structure:

```json
{
  "ingested_at": "timestamp",
  "processed_at": "timestamp",
  "processor": "service-or-adapter-name",
  "processor_version": "semver",
  "method": "rule|model|hybrid|manual",
  "inputs": ["record_id_1", "record_id_2"],
  "source_refs": [
    {
      "source_id": "zoominfo-websights",
      "source_record_id": "abc123"
    }
  ],
  "run_id": "optional",
  "trace_id": "optional"
}
```

## Field-level provenance

Field-level provenance is required when:
- fields are expanded from coded names
- fields are inferred or linked
- fields are ranked or mapped
- fields are merged from multiple candidates

Recommended field-level structure:

```json
{
  "company_name": {
    "method": "model",
    "sources": ["record_id_x"],
    "confidence": 0.91,
    "explanation_ref": "exp_123"
  },
  "glossary_mapping": {
    "method": "hybrid",
    "sources": ["record_id_y"],
    "confidence": 0.74,
    "explanation_ref": "exp_456"
  }
}
```

## Confidence model

Confidence must be explicit. SynapseIQ does not permit implied confidence.

### Confidence classes

Use both:
- numeric confidence in `[0.0, 1.0]`
- optional semantic band

Semantic bands:
- `high`
- `medium`
- `low`
- `unknown`

### Confidence sources

Confidence may be produced by:
- deterministic rules with explicit certainty
- model outputs
- hybrid ranking and matching pipelines
- human review

### Confidence interpretation

- `1.0` means deterministic or manually affirmed certainty within the current contract scope
- `0.0` means unusable or rejected
- missing confidence is invalid for heuristic, model, ranking, and merge outputs

## Confidence aggregation rules

### Single-source deterministic rule
A deterministic rule may set confidence to `1.0` if the rule is contractually exact.

### Model-derived value
Use model probability or calibrated score. Calibration method should be documented per adapter or model family.

### Hybrid result
For hybrid outputs, confidence should be computed by a declared composition strategy.

Allowed strategies:
- weighted average
- max-of-supported methods
- rule-dominant override
- review override

The chosen strategy must be declared in explanations or adapter docs.

## Merge semantics

Merging is where provenance and confidence become critical.

### Entity merge rules
When multiple candidate entity records are merged:
- preserve all source references
- preserve per-field confidence
- preserve competing candidate values where conflict is unresolved
- emit a merge explanation

### Conflict resolution priorities
Default precedence order:
1. manually reviewed value
2. deterministic exact rule value
3. high-confidence model value
4. lower-confidence model value
5. unknown confidence value

Conflicts that cannot be safely resolved should remain explicit rather than silently collapsed.

## Human review model

Human review must not erase machine evidence.

Recommended fields:

```json
{
  "review": {
    "status": "unreviewed|approved|rejected|corrected",
    "reviewed_by": "user-or-system-id",
    "reviewed_at": "timestamp",
    "notes": "optional"
  }
}
```

If a reviewer corrects a value, both the pre-review and post-review state should remain traceable.

## Explanation references

Confidence without explanation is weak. Explanations should be addressable via:
- inline explanation objects for small records
- explanation reference IDs for larger artifacts

Explanation payloads should include:
- why this result was produced
- what signals contributed
- what alternatives existed if relevant

## Warehouse requirements

The warehouse must preserve:
- record-level provenance in raw and staging
- field-level confidence for normalized and enriched outputs
- merge evidence for consolidated entities
- reviewer status where present

## Non-negotiable requirements

1. No heuristic or model output may be emitted without confidence.
2. No merged canonical value may discard source references.
3. Human review must remain layered on top of machine provenance, not overwrite it.
4. Confidence composition strategy must be declared for hybrid methods.
5. Explanations must be queryable or referenceable.

## Rationale

Provenance and confidence are part of the product’s truth model. Without them, SynapseIQ would be a black box. With them, it becomes an explainable, auditable semantic platform.