# Policy Lane

This lane defines machine-enforceable policy infrastructure for SynapseIQ.

It is intentionally provider-neutral.

Examples of provider mappings:
- OPA / Rego bundles
- policy evaluation sidecars or services
- warehouse policy overlays
- activation policy gateways

Provider-specific implementations should live under `infra/providers/<provider>/policy/` or similar overlays.