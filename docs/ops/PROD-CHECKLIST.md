# Production Checklist

This checklist is for the **internal alpha** release of SynapseIQ Tabular Alpha API.

## Pre-deploy

- [ ] Narrow scope confirmed: tabular/glossary mapping only
- [ ] Service builds locally
- [ ] Health and readiness endpoints respond
- [ ] Contract tests pass
- [ ] Schema validation tests pass
- [ ] Environment variables set
- [ ] Deployment target selected

## Deploy

- [ ] Deploy one instance or equivalent narrow target
- [ ] Verify `/healthz`
- [ ] Verify `/readyz`
- [ ] Send one known-good request to `/ingest/tabular`
- [ ] Confirm `202 accepted`

## Post-deploy

- [ ] Review logs for errors
- [ ] Verify latency is acceptable for internal use
- [ ] Verify no unexpected crash loops
- [ ] Limit access to intended internal audience only

## Explicit non-goals tonight

- multi-tenant public launch
- multiple adapters in production simultaneously
- full control-plane or reasoning-plane rollout
