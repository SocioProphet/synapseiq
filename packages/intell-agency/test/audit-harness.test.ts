import { test } from "node:test";
import assert from "node:assert/strict";
import { computeGci, DEFAULT_GCI_THRESHOLDS } from "../src/gci.ts";
import { computeTci } from "../src/tci.ts";
import { auditArtifact } from "../src/audit-harness.ts";

const lowGci = {
  operatorCount: 6, fixityGraphDensity: 0.1, precedenceDensity: 0.1, ambiguityRatio: 0.02,
  externalTokenShare: 0.05, recoveryRate: 1.0, scannerHealth: 1.0,
};
const highGci = {
  operatorCount: 50, fixityGraphDensity: 0.8, precedenceDensity: 0.7, ambiguityRatio: 0.4,
  externalTokenShare: 0.4, recoveryRate: 0.5, scannerHealth: 0.4,
};
const lowTci = {
  dependentDepth: 1, piSigmaDensity: 0.1, witnessAttributeRatio: 0.95, instanceResolutionDensity: 2,
  equalityEdges: 1, reflectionRate: 0, sizeIndexStrictness: 0.5,
};
const highTci = {
  dependentDepth: 7, piSigmaDensity: 0.8, witnessAttributeRatio: 0.1, instanceResolutionDensity: 18,
  equalityEdges: 15, reflectionRate: 6, sizeIndexStrictness: 0.9,
};

test("GCI: external-token share over the §14 block threshold forces a block + finding", () => {
  const r = computeGci(highGci);
  assert.equal(r.decision, "block");
  assert.ok(r.findings.some((f) => /external-token share/.test(f)));
  // a clean grammar passes
  assert.equal(computeGci(lowGci).decision, "ok");
});

test("TCI: instance-resolution + reflection over the §7.4 block thresholds force a block", () => {
  const r = computeTci(highTci);
  assert.equal(r.decision, "block");
  assert.ok(r.findings.some((f) => /instance-resolution density/.test(f)));
  assert.ok(r.findings.some((f) => /reflection rate/.test(f)));
  // low-witness-ratio raises the injection contribution that feeds IRI
  assert.ok(r.injectionContribution > 0.4);
  assert.ok(computeTci(lowTci).injectionContribution < 0.2);
});

test("audit harness: clean artifact with consent credits → proceed + bijection", () => {
  const r = auditArtifact({ gci: lowGci, tci: lowTci, consentHoleCredits: 0.6, fitToExpected: 0.85, stability: 0.8, proxyEvidence: 0.1 });
  assert.equal(r.decision, "proceed");
  assert.equal(r.iri.decision, "proceed");
  assert.equal(r.fit, "bijection");
});

test("audit harness FAILS CLOSED: any blocking index blocks the gate", () => {
  const r = auditArtifact({ gci: highGci, tci: lowTci, consentHoleCredits: 0.5 });
  assert.equal(r.decision, "block"); // GCI blocks → whole gate blocks
  assert.ok(r.findings.some((f) => /GCI:/.test(f)));
});

test("audit harness: latent-attribute-heavy types drive IRI up; consent credits pull it back", () => {
  const risky = auditArtifact({ gci: highGci, tci: highTci, consentHoleCredits: 0 });
  const credited = auditArtifact({ gci: highGci, tci: highTci, consentHoleCredits: 1 });
  assert.ok(credited.iri.score < risky.iri.score); // consent-hole credits reduce identity risk
  assert.equal(risky.decision, "block");
});
