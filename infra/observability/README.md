# Observability Lane

This lane defines logging, metrics, tracing, dashboards, alerting, and SLO/SLA posture for SynapseIQ.

It is intentionally provider-neutral.

Examples of provider mappings:
- OpenTelemetry collectors and exporters
- Prometheus and Grafana
- cloud-native logging and monitoring backends
- tracing backends

Provider-specific implementations should live under `infra/providers/<provider>/observability/` or similar overlays.