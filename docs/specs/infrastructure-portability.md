# Infrastructure Portability Specification

This document defines the infrastructure portability posture for **SynapseIQ**.

SynapseIQ must not be architected as a thin wrapper around any one cloud provider's product taxonomy.

## Principle

Infrastructure in SynapseIQ is modeled by **capability lane**, not by vendor product name.

That means we design for:
- runtime
- messaging
- warehouse
- identity and access
- observability
- secrets and configuration
- policy enforcement
- deployment orchestration

And only then map those lanes onto provider-specific implementations.

## Provider-neutral infrastructure lanes

Recommended top-level infrastructure shape:

```text
infra/
  runtime/
  messaging/
  warehouse/
  identity-access/
  observability/
  secrets-config/
  policy/
  deployment/
  providers/
    gcp/
    aws/
    azure/
    kubernetes/
    local/
```

## Lane semantics

### `runtime/`
Defines how services execute.

Portable targets may include:
- serverless containers
- long-running containers
- Kubernetes workloads
- local developer runners

Examples:
- Cloud Run
- ECS/Fargate
- AKS
- Kubernetes Deployments
- Docker Compose local runtime

### `messaging/`
Defines asynchronous transport.

Portable targets may include:
- Kafka
- Pub/Sub
- Kinesis
- Event Hubs
- NATS

### `warehouse/`
Defines analytical storage and materialization.

Portable targets may include:
- BigQuery
- Snowflake
- ClickHouse
- Postgres/Timescale for smaller deployments
- Iceberg/Delta/Lakehouse stacks

### `identity-access/`
Defines service identities, permissions, and boundary controls.

Portable targets may include:
- IAM roles and policies
- service accounts
- workload identity mechanisms
- OIDC federation

### `observability/`
Defines logging, metrics, tracing, dashboards, and alerts.

Portable targets may include:
- OpenTelemetry
- Prometheus
- Grafana
- Cloud-native monitoring backends

### `secrets-config/`
Defines runtime configuration and secret delivery.

Portable targets may include:
- cloud secrets managers
- Vault
- SOPS-managed config
- Kubernetes secrets/config maps

### `policy/`
Defines policy enforcement surfaces.

Portable targets may include:
- OPA / Rego
- custom policy evaluators
- warehouse row/column policy systems

### `deployment/`
Defines CI/CD and release orchestration.

Portable targets may include:
- GitHub Actions
- Cloud Build
- ArgoCD
- Flux
- Terraform/OpenTofu pipelines

## Provider overlays

Provider-specific implementation details belong under `infra/providers/<provider>/`, not at the top level.

Examples:
- `infra/providers/gcp/cloud-run/`
- `infra/providers/gcp/pubsub/`
- `infra/providers/gcp/bigquery/`
- `infra/providers/aws/ecs/`
- `infra/providers/aws/kinesis/`
- `infra/providers/local/docker-compose/`

## Why this matters

If the repository is shaped directly as:
- `cloud-run/`
- `pubsub/`
- `bigquery/`
- `iam/`
- `monitoring/`

then the product architecture quietly becomes GCP-native rather than capability-native.

That makes future portability and even local development more expensive.

## Required posture

1. **Specs** must describe capability lanes first.
2. **Code** must target abstract contracts where possible.
3. **Provider implementations** must be isolated as overlays.
4. **Open standards** should be preferred at the control and telemetry layers.
5. The first implementation may use GCP, but the architecture must not assume GCP.

## Non-negotiable requirements

1. Runtime, messaging, warehouse, and observability must each have provider-neutral conceptual contracts.
2. Provider-specific directories must live under `infra/providers/`.
3. Telemetry should standardize on OpenTelemetry where practical.
4. CI/CD should be able to target more than one runtime mode over time.

## Initial implementation guidance

It is acceptable for the first deployment to use GCP.

However, the repo should represent that as:
- provider-neutral lane docs and interfaces
- GCP overlay implementations

rather than making GCP’s product names the architecture.

## Rationale

SynapseIQ is a product platform. Product platforms should be capability-shaped and standards-aware, not provider-shaped. This keeps us portable, testable, and strategically independent.