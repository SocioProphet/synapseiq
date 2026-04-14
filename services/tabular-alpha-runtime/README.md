# Tabular Alpha Runtime

This directory is the narrowest deployable internal alpha runtime for SynapseIQ.

It is intentionally separate from the broader TypeScript service package so that Cloud Run source deployment can be used tonight with minimal friction.

Endpoints:
- `GET /healthz`
- `GET /readyz`
- `POST /ingest/tabular`
