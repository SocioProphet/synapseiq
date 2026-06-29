import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Budget, consentHole, fillConsentHole, dominates, satisfyObligation,
  type DPBudget, type PolicyLabel, type PurposeId, type ConsentWitness,
} from "../src/governance.ts";

const purpose = "purpose_identity_resolution" as PurposeId;

test("DP budget monoid: zero/plus, and minus FAILS CLOSED on exhaustion", () => {
  assert.deepEqual(Budget.zero(), { epsilon: 0, delta: 0, windowDays: 0 });
  const a: DPBudget = { epsilon: 1, delta: 0.1, windowDays: 30 };
  const b: DPBudget = { epsilon: 0.5, delta: 0, windowDays: 7 };
  assert.deepEqual(Budget.plus(a, b), { epsilon: 1.5, delta: 0.1, windowDays: 30 });
  assert.deepEqual(Budget.minus(a, 0.4), { epsilon: 0.6, delta: 0.1, windowDays: 30 });
  assert.throws(() => Budget.minus(a, 2), /DP budget exhausted/); // fail closed
  assert.equal(Budget.solventAfter(a, 2), false);
});

test("consent-hole: AUTO-FILL forbidden; a witness must match purpose + be signed + respect retention", () => {
  const hole = consentHole<{ activist: boolean }>(purpose, 30, { epsilon: 0.5, windowDays: 30 });
  // a valid witness fills it
  const w: ConsentWitness<{ activist: boolean }> = { purpose, value: { activist: true }, signature: "did:key:zABC", retentionDays: 30 };
  assert.deepEqual(fillConsentHole(hole, w), { activist: true });
  // unsigned (the auto-fill / guess path) is refused
  assert.throws(() => fillConsentHole(hole, { ...w, signature: "" }), /signature/);
  // purpose mismatch refused
  assert.throws(() => fillConsentHole(hole, { ...w, purpose: "purpose_other" as PurposeId }), /purpose mismatch/);
  // retention beyond the hole's bound refused
  assert.throws(() => fillConsentHole(hole, { ...w, retentionDays: 90 }), /retention/);
});

test("label lattice dominance: clearance, purpose-binding, retention, sensitivity, jurisdiction, DP all required", () => {
  const base: PolicyLabel = { clearance: 3, purpose, retentionDays: 30, dp: { epsilon: 2, windowDays: 30 }, sensitivity: "high" };
  const resource: PolicyLabel = { clearance: 2, purpose, retentionDays: 14, dp: { epsilon: 1, windowDays: 30 }, sensitivity: "high" };
  assert.equal(dominates(base, resource), true);
  assert.equal(dominates({ ...base, clearance: 1 }, resource), false);            // clearance too low
  assert.equal(dominates({ ...base, purpose: "purpose_x" as PurposeId }, resource), false); // wrong purpose
  assert.equal(dominates({ ...base, sensitivity: "low" }, resource), false);      // sensitivity clearance too low
  assert.equal(dominates(base, { ...resource, jurisdiction: "EU" }), false);      // resource pins a jurisdiction
  assert.equal(dominates({ ...base, dp: { epsilon: 0.5, windowDays: 30 } }, resource), false); // can't cover DP
});

test("obligation satisfaction yields a witness and requires an artifact hash", () => {
  const w = satisfyObligation({ kind: "deletion", dueBy: "2026-07-01T00:00:00Z", label: { clearance: 1, purpose, retentionDays: 30, dp: Budget.zero(), sensitivity: "high" } }, "2026-06-30T00:00:00Z", "sha256-deadbeef");
  assert.equal(w.obligationKind, "deletion");
  assert.equal(w.artifactHash, "sha256-deadbeef");
  assert.throws(() => satisfyObligation({ kind: "audit", dueBy: "x", label: { clearance: 1, purpose, retentionDays: 1, dp: Budget.zero(), sensitivity: "low" } }, "now", ""), /artifact hash/);
});
