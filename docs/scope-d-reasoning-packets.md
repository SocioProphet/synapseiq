# SynapseIQ: SCOPE-D Reasoning Packets v0.1

This slice lets SynapseIQ consume SCOPE-D cyber graph exports and produce deterministic reasoning packets.

## Input

```text
SCOPE-D CyberGraphExport
```

The input must have `executionPerformed=false`.

## Output

```text
ScopeDReasoningPacket
```

The packet contains:

- graph-grounded hypotheses;
- confidence summary;
- contradiction records;
- recommended next actions;
- evidence node references;
- evidence edge references.

## Claim boundary

Every claim must resolve to graph or receipt references.

```text
all_claims_must_resolve_to_graph_or_receipt_refs
```

## First hypotheses

v0.1 generates hypotheses for:

- detection candidates;
- ATT&CK mappings;
- CloudShell Fog edge assurance posture.

## Contradictions

v0.1 flags:

- ungrounded detection candidates;
- low-confidence detection candidates;
- orphan evidence receipts.

## Safety boundary

This package does not execute security actions, call external services, deploy controls, or operate CloudShell Fog. It emits reasoning packets only.

## Commands

```bash
pnpm run test:scope-d-reasoning
pnpm test
```

## Next slices

1. Add Sherlock result ingestion.
2. Add Orion field intelligence inputs.
3. Add confidence propagation across graph neighborhoods.
4. Add contradiction severity policy.
5. Add Noetica explanation view payloads.
