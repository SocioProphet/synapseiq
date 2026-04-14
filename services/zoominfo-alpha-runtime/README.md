# ZoomInfo Alpha Runtime

This service is a narrow internal alpha runtime for ZoomInfo-style identity touch ingestion.

## Scope

It accepts a representative ZoomInfo payload and emits canonical:
- `event` envelope
- `entity` envelope for organization when present
- `entity` envelope for person when present

## Endpoints

- `GET /health`
- `GET /ready`
- `POST /ingest/zoominfo`

## Notes

This runtime is intentionally narrow and intended for controlled internal rollout.
