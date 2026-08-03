import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateObservation,
  validateWorldModelRef,
  type Observation,
  type WorldModelRef,
} from "../src/world-model.ts";

const policyRef = { id: "policy_default" as const, version: "1", fingerprint: "sha256-abc" };

function obs(over: Partial<Observation<{ v: number }>> = {}): Observation<{ v: number }> {
  return {
    id: "obs_1",
    policyRef,
    provenance: { source: "ingest", acquiredAt: "2026-08-02T00:00:00Z", schema: "schema://event" },
    redaction: "none",
    payload: { v: 1 },
    ...over,
  };
}

function model(over: Partial<WorldModelRef> = {}): WorldModelRef {
  return {
    id: "wm_1",
    version: "1",
    uri: "s3://models/wm_1",
    checksum: "sha256-deadbeef",
    ontology: { id: "onto", version: "1", checksum: "sha256-onto" },
    sbomUri: "s3://sbom/wm_1",
    license: "MIT",
    policyFingerprint: "sha256-pol",
    trainingLineageUri: "s3://lineage/wm_1",
    evaluationCommitments: ["holdout-f1>=0.8"],
    ...over,
  };
}

test("Observation: a clean record validates", () => {
  assert.deepEqual(validateObservation(obs()), { ok: true, problems: [] });
});

test("Observation: sensitive classification MUST NOT ride on raw (redaction=none)", () => {
  const r = validateObservation(obs({ classification: { labels: ["health"] }, redaction: "none" }));
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => /sensitive classification requires/.test(p)));
  // ... but pseudonymized is allowed
  assert.equal(validateObservation(obs({ classification: { labels: ["health"] }, redaction: "pseudonymized" })).ok, true);
});

test("Observation: fail-closed on bad id / policy ref / schema uri", () => {
  assert.equal(validateObservation(obs({ id: "x_1" as never })).ok, false);
  assert.equal(validateObservation(obs({ policyRef: { ...policyRef, fingerprint: "nope" } })).ok, false);
  assert.equal(validateObservation(obs({ provenance: { source: "s", acquiredAt: "t", schema: "http://x" as never } })).ok, false);
});

test("WorldModelRef: a complete artifact validates", () => {
  assert.deepEqual(validateWorldModelRef(model()), { ok: true, problems: [] });
});

test("WorldModelRef: MUST carry checksum + policy fingerprint + SBOM + license + lineage + eval", () => {
  assert.ok(validateWorldModelRef(model({ checksum: "" })).problems.some((p) => /checksum/.test(p)));
  assert.ok(validateWorldModelRef(model({ policyFingerprint: "nope" })).problems.some((p) => /policyFingerprint/.test(p)));
  assert.ok(validateWorldModelRef(model({ sbomUri: "" })).problems.some((p) => /SBOM/.test(p)));
  assert.ok(validateWorldModelRef(model({ license: "" })).problems.some((p) => /license/.test(p)));
  assert.ok(validateWorldModelRef(model({ trainingLineageUri: "" })).problems.some((p) => /lineage/.test(p)));
  assert.ok(validateWorldModelRef(model({ evaluationCommitments: [] })).problems.some((p) => /evaluation/.test(p)));
});

test("WorldModelRef: embedding index requires dimensionality + checksum", () => {
  const bad = model({ embeddings: { uri: "s3://emb", dimensionality: 0, source: "x", checksum: "" } });
  assert.equal(validateWorldModelRef(bad).ok, false);
});
