# Secrets and Config Lane

This lane defines secret delivery, runtime configuration, and environment-specific configuration posture for SynapseIQ.

It is intentionally provider-neutral.

Examples of provider mappings:
- cloud secrets managers
- Vault
- SOPS-managed configuration
- Kubernetes secrets and config maps
- local development .env overlays where appropriate

Provider-specific implementations should live under `infra/providers/<provider>/secrets-config/` or similar overlays.