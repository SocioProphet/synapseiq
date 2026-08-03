/**
 * red-team.test.ts — BME §16 mandatory red-team suite.
 *
 * Each test is an ADVERSARIAL attempt to defeat a fail-closed guarantee; the guarantee must hold. This is the
 * suite the CI gate (§22) runs to prove the governance core cannot be talked out of its invariants.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { computeIri } from "../src/iri.ts";
import { Budget, consentHole, fillConsentHole, type ConsentWitness, type DPBudget } from "../src/governance.ts";
import { InMemoryEqualityGate } from "../src/equality.ts";
import { boundaryFlipsUnsafe, stableGuard } from "../src/numeric.ts";
import { validateProofPack, type ProofPack } from "../src/proof-pack.ts";
import { validateWorldModelRef, type WorldModelRef } from "../src/world-model.ts";
import type { PurposeId } from "../src/governance.ts";

const purpose = "purpose_x" as PurposeId;

test("red-team · proxy-hunt: a high-uniqueness + high-normativity artifact is BLOCKED by IRI", () => {
  const r = computeIri({ entropyUniqueness: 1, injectionNormativity: 1, consentHoleCredits: 0 });
  assert.equal(r.decision, "block");
  // and consent-hole credits cannot buy your way past a block with a trivial credit
  assert.equal(computeIri({ entropyUniqueness: 1, injectionNormativity: 1, consentHoleCredits: 0.2 }).decision, "block");
});

test("red-team · silent-merge: finalizing an identity merge WITHOUT a Canonical witness throws", () => {
  const gate = new InMemoryEqualityGate<{ id: string }>();
  const { ticketId } = gate.requestMerge({ id: "a" }, { id: "b" }, purpose);
  assert.throws(() => gate.finalize(ticketId, (a) => a), /no Canonical<T> witness/);
});

test("red-team · DP-exhaustion: spending past the budget fails closed", () => {
  const b: DPBudget = { epsilon: 0.5, delta: 0, windowDays: 30 };
  assert.equal(Budget.solventAfter(b, 1.0), false);
  assert.throws(() => Budget.minus(b, 1.0), /DP budget exhausted/);
});

test("red-team · consent auto-fill: filling a consent-hole without a matching, signed witness throws", () => {
  const hole = consentHole<string>(purpose, 30, { epsilon: 1, windowDays: 30 });
  const unsigned: ConsentWitness<string> = { purpose, value: "secret", signature: "" };
  assert.throws(() => fillConsentHole(hole, unsigned), /auto-fill forbidden|signature/);
  const wrongPurpose: ConsentWitness<string> = { purpose: "purpose_other" as PurposeId, value: "secret", signature: "sig" };
  assert.throws(() => fillConsentHole(hole, wrongPurpose), /purpose mismatch/);
});

test("red-team · numeric boundary flip: a value within tolerance of a threshold is flagged unstable", () => {
  assert.equal(boundaryFlipsUnsafe(0.5000001, 0.5, 0.01, 1e-9), true);
  assert.equal(stableGuard(0.5000001, 0.5, 0.01, 1e-9).stable, false);
  // a value comfortably clear of the boundary is stable
  assert.equal(stableGuard(0.9, 0.5, 0.01, 1e-9).stable, true);
});

test("red-team · unsigned artifact: an unsigned proof-pack is rejected", () => {
  const pack: ProofPack = {
    artifact: "proof-pack", id: "p1", subject: "s",
    policyFingerprint: "sha256-x", source: { repo: "r", commit: "c", path: "p" },
    checks: { iri: 0.1, dpBudgetRemaining: { epsilon: 1, delta: 0, windowDays: 30 } },
    witnesses: [], signatures: [], merkleRoot: "sha256-y",
  };
  const v = validateProofPack(pack);
  assert.equal(v.ok, false);
  assert.ok(v.problems.some((p) => /signature/.test(p)));
});

test("red-team · unsigned model update: a world-model missing lineage/SBOM/fingerprint is rejected", () => {
  const m = {
    id: "wm_1", version: "1", uri: "u", checksum: "sha256-c",
    ontology: { id: "o", version: "1", checksum: "sha256-o" },
    sbomUri: "", license: "", policyFingerprint: "nope",
    trainingLineageUri: "", evaluationCommitments: [],
  } as WorldModelRef;
  assert.equal(validateWorldModelRef(m).ok, false);
});
