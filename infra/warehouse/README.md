# Warehouse Lane

This lane defines analytical storage and materialization backends for SynapseIQ.

It is intentionally provider-neutral.

Examples of provider mappings:
- BigQuery
- Snowflake
- ClickHouse
- Iceberg/Delta-based lakehouse stacks
- Postgres/Timescale for smaller deployments

Provider-specific implementations should live under `infra/providers/<provider>/warehouse/` or similar overlays.