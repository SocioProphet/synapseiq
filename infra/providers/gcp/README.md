# GCP Provider Overlay

This directory will contain Google Cloud specific infrastructure implementations for SynapseIQ.

Expected mappings:
- runtime -> Cloud Run or GKE
- messaging -> Pub/Sub or Kafka on managed infrastructure
- warehouse -> BigQuery
- identity-access -> IAM and service accounts
- observability -> Cloud Monitoring / Logging plus OpenTelemetry export where applicable

This is an implementation overlay, not the architecture itself.