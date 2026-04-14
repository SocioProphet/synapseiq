# GCP Runtime Overlay: Tabular Alpha

This note describes the initial narrow GCP deployment target for the Tabular Alpha API.

## Intended target

- internal alpha only
- one narrow service
- limited audience
- easy rollback

## Suggested runtime

A simple first target is a single Cloud Run service.

## Environment

Expected environment variables:
- `PORT`
- `LOG_LEVEL`

## Deployment posture

Use a distinct service name for the alpha so it does not get confused with future broader SynapseIQ runtime surfaces.

Example service naming idea:
- `synapseiq-tabular-alpha`

## Notes

This is a provider-specific overlay note, not the canonical architecture.