# Infrastructure Capability Lanes

This document is the authoritative infrastructure shape for **SynapseIQ**.

If any older file in the repository still reflects provider-specific top-level directories, this document supersedes that shape.

## Canonical infrastructure shape

```text
infra/
  runtime/
  messaging/
  warehouse/
  identity-access/
  observability/
  secrets-config/
  policy/
  deployment/
  providers/
    gcp/
    aws/
    azure/
    kubernetes/
    local/
```

## Interpretation

- top-level directories represent **capability lanes**
- provider-specific details live under `providers/`
- provider choice is an overlay, not the architecture

## Current posture

The initial implementation may target GCP, but the repository should remain capability-shaped and standards-aware.