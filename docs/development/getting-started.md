# Getting Started

## Prerequisites

- Node.js 20+
- pnpm 10+

## Install

```bash
pnpm install --no-frozen-lockfile
```

## Key workspace commands

```bash
pnpm typecheck
pnpm test
pnpm --filter @socioprophet/synapseiq-contract-tests test
pnpm --filter @socioprophet/synapseiq-enrichment-api typecheck
pnpm --filter @socioprophet/synapseiq-enrichment-collector typecheck
```

## Suggested read order

1. `docs/adr/0001-product-scope.md`
2. `docs/specs/contract-taxonomy.md`
3. `docs/specs/canonical-envelope.md`
4. `docs/specs/adapter-sdk.md`
5. `docs/specs/stream-contract.md`
6. `docs/specs/warehouse-contract.md`
7. `docs/specs/infrastructure-portability.md`

## Current implementation path

Today the repo contains:
- the canonical envelope schema
- typed contracts
- a normalization package
- an enrichment package with a base adapter and initial adapter slices
- synchronous ingress and asynchronous collector service stubs
- a contract-test package and fixtures

## Immediate next implementation goals

- wire executable schema validation into tests and services
- patch remaining package-graph coherence gaps
- add first warehouse model artifacts
- add the next vendor and generic adapters
