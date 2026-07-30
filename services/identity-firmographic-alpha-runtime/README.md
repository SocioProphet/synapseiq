# Identity-Firmographic Alpha Runtime

This service is a narrow internal alpha runtime for Identity-Firmographic-style identity touch ingestion.

## Scope

It accepts a representative Identity-Firmographic payload and emits canonical:
- `event` envelope
- `entity` envelope for organization when present
- `entity` envelope for person when present

## Endpoints

- `GET /health`
- `GET /ready`
- `POST /ingest/identity-firmographic`

## Notes

This runtime is intentionally narrow and intended for controlled internal rollout.
