import { test } from "node:test";
import assert from "node:assert/strict";
import { computeIri, classifyFit, DEFAULT_IRI_THRESHOLDS } from "../src/iri.ts";
import { withinTolerance, boundaryFlipsUnsafe, stableGuard } from "../src/numeric.ts";
import { validateProofPack, type ProofPack } from "../src/proof-pack.ts";

test("IRI: consent-hole credits REDUCE risk; latent uniqueness/normativity RAISE it; decision banding", () => {
  // high uniqueness + high normativity, no consent credit → block
  const risky = computeIri({ entropyUniqueness: 0.9, injectionNormativity: 0.9, consentHoleCredits: 0 });
  assert.equal(risky.decision, "block");
  assert.ok(risky.score >= DEFAULT_IRI_THRESHOLDS.block);
  // same signals but generous consent-hole credit pulls the score down
  const credited = computeIri({ entropyUniqueness: 0.9, injectionNormativity: 0.9, consentHoleCredits: 1 });
  assert.ok(credited.score < risky.score);
  // a calibrated system proceeds
  const calm = computeIri({ entropyUniqueness: 0.2, injectionNormativity: 0.2, consentHoleCredits: 0.5 });
  assert.equal(calm.decision, "proceed");
});

test("fit classifier: surjection (underfit) / injection (rigid+unstable) / bijection (calibrated)", () => {
  assert.equal(classifyFit({ fitToExpected: 0.4, proxyEvidence: 0.7, normativity: 0.3, stability: 0.8 }), "surjection");
  assert.equal(classifyFit({ fitToExpected: 0.9, proxyEvidence: 0.1, normativity: 0.8, stability: 0.3 }), "injection");
  assert.equal(classifyFit({ fitToExpected: 0.85, proxyEvidence: 0.1, normativity: 0.3, stability: 0.8 }), "bijection");
});

test("numeric tolerance + boundary-flip stability guard", () => {
  assert.equal(withinTolerance(1.0000001, 1, 1e-6), true);
  assert.equal(withinTolerance(1.1, 1, 1e-6), false);
  // a value sitting inside the guard band (or margin < ε) is UNSTABLE
  assert.equal(boundaryFlipsUnsafe(0.500001, 0.5, 0.01, 1e-6), true);
  assert.equal(boundaryFlipsUnsafe(0.7, 0.5, 0.01, 1e-6), false);
  assert.equal(boundaryFlipsUnsafe(0.7, 0.5, 1e-9, 1e-6), true); // margin < epsilon → unstable
  assert.deepEqual(stableGuard(0.7, 0.5, 0.01, 1e-6), { pass: true, stable: true });
  assert.deepEqual(stableGuard(0.5001, 0.5, 0.01, 1e-6), { pass: false, stable: false });
});

test("proof-pack validation: signed + sha256-prefixed + non-negative DP budget", () => {
  const good: ProofPack = {
    artifact: "proof-pack", id: "proof_001", subject: "mapping.identity_touch",
    policyFingerprint: "sha256-aaa", source: { repo: "SocioProphet/synapseiq", commit: "abc", path: "packages/x" },
    checks: { iri: 0.21, dpBudgetRemaining: { epsilon: 1.4, delta: 0, windowDays: 30 } },
    witnesses: [{ type: "consent", hash: "sha256-w", sig: "did:key:1" }],
    signatures: ["did:key:1"], merkleRoot: "sha256-root",
  };
  assert.equal(validateProofPack(good).ok, true);
  assert.equal(validateProofPack({ ...good, signatures: [] }).ok, false);                       // unsigned
  assert.equal(validateProofPack({ ...good, merkleRoot: "root" }).ok, false);                   // not hashed
  assert.equal(validateProofPack({ ...good, checks: { iri: 0.2, dpBudgetRemaining: { epsilon: -1, windowDays: 30 } } }).ok, false); // negative budget
});
