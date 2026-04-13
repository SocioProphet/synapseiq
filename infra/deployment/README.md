# Deployment Lane

This lane defines release orchestration and deployment workflows for SynapseIQ.

It is intentionally provider-neutral.

Examples of provider mappings:
- GitHub Actions
- Cloud Build
- ArgoCD
- Flux
- Terraform/OpenTofu-driven deployment pipelines

Provider-specific implementations should live under `infra/providers/<provider>/deployment/` or similar overlays.