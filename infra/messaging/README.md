# Messaging Lane

This lane defines asynchronous transport for SynapseIQ.

It is intentionally provider-neutral.

Examples of provider mappings:
- Kafka
- GCP Pub/Sub
- AWS Kinesis
- Azure Event Hubs
- NATS

Provider-specific implementations should live under `infra/providers/<provider>/messaging/` or similar overlays.