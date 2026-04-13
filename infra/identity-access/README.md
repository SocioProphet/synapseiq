# Identity and Access Lane

This lane defines service identity, access boundaries, and permission posture for SynapseIQ.

It is intentionally provider-neutral.

Examples of provider mappings:
- cloud IAM roles and policies
- service accounts
- workload identity federation
- OIDC trust relationships
- Kubernetes service accounts and RBAC

Provider-specific implementations should live under `infra/providers/<provider>/identity-access/` or similar overlays.