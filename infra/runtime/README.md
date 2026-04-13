# Runtime Lane

This lane defines how SynapseIQ services execute.

It is intentionally provider-neutral.

Examples of provider mappings:
- GCP Cloud Run
- AWS ECS/Fargate
- Kubernetes Deployments
- local Docker Compose

Provider-specific implementations should live under `infra/providers/<provider>/runtime/` or similar overlays.