# Contributing to SynapseIQ

## Contribution posture

SynapseIQ is being built as a product platform. Contributions should preserve:
- contract stability
- semantic clarity
- provider neutrality where intended
- explainability and provenance
- testability

## Expected workflow

1. Read the core specs in `docs/specs/` before changing code.
2. If a change alters architecture or contracts, update the relevant spec and add an ADR when needed.
3. Keep changes small and legible.
4. Add tests with code changes where practical.
5. Avoid embedding provider-specific assumptions into canonical contracts.

## Priority order

1. contracts and schemas
2. package boundaries
3. service behavior
4. provider-specific implementations

## Pull request expectations

A good PR should explain:
- what changed
- why it changed
- which spec or ADR it relates to
- any compatibility implications
- any follow-on work

## Coding expectations

- prefer explicit types
- keep side effects visible
- preserve provenance and confidence fields
- do not silently drop policy-relevant information

## Architectural discipline

If you are unsure whether something belongs in a vendor adapter, a shared package, or a service, bias toward shared contracts and small adapters.
