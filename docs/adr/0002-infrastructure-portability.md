# ADR 0002: Infrastructure Portability

## Status
Accepted

## Context

Early repository shaping started to reflect GCP product categories directly:
- Cloud Run
- Pub/Sub
- BigQuery
- IAM
- Monitoring

That would make the architecture look GCP-native even if the product intent is broader.

SynapseIQ is intended to be a product platform and should not be structurally tied to one cloud’s product names at the architectural level.

## Decision

SynapseIQ infrastructure will be modeled by **capability lane** first, with provider-specific overlays second.

Primary lanes:
- runtime
- messaging
- warehouse
- identity-access
- observability
- secrets-config
- policy
- deployment

Provider-specific implementation details will live under:
- `infra/providers/<provider>/...`

## Consequences

### Positive
- clearer portability posture
- better local and multi-cloud development story
- cleaner alignment with open standards and control-plane abstractions
- less accidental vendor lock-in in repo structure

### Negative
- initial documentation and scaffolding are slightly more abstract
- some provider-specific simplicity is sacrificed in favor of long-term correctness

## Rationale

The first implementation may still use GCP, but the architecture should remain capability-shaped so that future deployment targets, local development modes, and alternative backends do not require a repository redesign.