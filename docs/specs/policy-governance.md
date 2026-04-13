# Policy and Governance Specification

This document defines the policy and governance surface for **SynapseIQ**.

Policy is not an afterthought. It is a first-class product contract that governs:
- what may be ingested
- what may be retained
- what may be enriched
- what may be emitted
- what must be redacted or suppressed
- who may access which outputs

## Goals

1. Make governance explicit and machine-enforceable
2. Keep privacy, consent, and retention attached to records
3. Separate policy evaluation from vendor-specific logic
4. Preserve evidence of policy decisions

## Policy domains

SynapseIQ policy operates across these domains:
- consent
- classification
- retention
- redaction
- access control
- export control / activation control
- review and override

## Consent model

Consent states should be represented explicitly.

Allowed values:
- `granted`
- `denied`
- `unknown`
- `not_applicable`

Consent should be tracked by policy purpose where relevant:
- analytics
- personalization
- activation
- external_sharing

## Classification model

Recommended classification levels:
- `public`
- `internal`
- `confidential`
- `restricted`

Adapters and services must not downgrade classification without a declared policy rule.

## Retention model

Retention must be declared as a policy class rather than scattered ad hoc TTLs.

Recommended retention classes:
- `raw-short`
- `staging-medium`
- `curated-long`
- `legal-hold`

Infrastructure should enforce these classes at the dataset or topic level where possible.

## Redaction model

Redactions must be explicit and traceable.

Redactions may occur:
- at ingest
- at normalization
- at warehouse materialization
- at serving/activation time

Every redaction decision should record:
- field name
- reason
- policy rule id if available
- processor
- timestamp

## Access model

Access control should be enforced across:
- API surfaces
- warehouse datasets and views
- stream subscriptions
- developer tooling where necessary

Access should be role-based and policy-aware.

## Activation policy

Not all enriched records may be emitted to downstream systems.

Activation decisions should consider:
- consent state
- classification
- confidence threshold
- destination system policy
- human review requirement

## Review and override

Policy should support:
- machine decisions
- manual review
- documented overrides

Overrides must remain auditable and should not erase original policy findings.

## Policy evaluation outputs

Policy evaluation should be able to emit `finding` records containing:
- decision (`allow|deny|redact|review`)
- policy domain
- rule identifier
- rationale
- affected fields

## Non-negotiable requirements

1. Consent and classification must be explicit on records where applicable.
2. Redactions must be traceable.
3. Activation must be policy-gated, not adapter-gated.
4. Overrides must remain auditable.
5. Policy decisions must be explainable.

## Rationale

Without an explicit policy layer, SynapseIQ would accumulate inconsistent privacy and governance behavior across adapters and downstream integrations. A first-class policy contract keeps the platform coherent, auditable, and production-safe.