# Tabular Alpha API

This service is the narrow internal alpha candidate for SynapseIQ tonight.

## Scope

It accepts tabular/glossary mapping requests and emits canonical `mapping` envelopes.

## Endpoints

- `GET /healthz`
- `GET /readyz`
- `POST /ingest/tabular`

## Example request

```json
{
  "table_name": "COMMUNICATION",
  "column_name": "PLN_END_DT",
  "column_description": "The date on which the communication is planned to be completed.",
  "glossary_candidates": [
    "Communication Expected End Date",
    "Planned End Date"
  ]
}
```

## Notes

This is an internal alpha service. It is intentionally narrow and designed for controlled rollout.
