# Envelope Fixture Test Plan

This file defines the first contract test expectations for the canonical envelope.

## Valid fixture
- `fixtures/envelope.valid.json` should satisfy the canonical envelope schema.

## Invalid fixture
- `fixtures/envelope.invalid.json` should fail validation because `record_kind` is missing.

## Implementation note
The first executable contract test harness should load these fixtures and validate them against `packages/schemas/envelope.schema.json`.
