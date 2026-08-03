import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { toCanonicalProofPack, type EpistemicLevel } from "../src/proof-pack-canonical.ts";
import type { ProofPack } from "../src/proof-pack.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
// canonical schema vendored from prophet-core-contracts (commit 6e8a1647, sha256 bb581529…)
const schema = JSON.parse(readFileSync(join(HERE, "fixtures/proof-pack.schema.json"), "utf8"));
const validate = new Ajv2020({ strict: false }).compile(schema);

function localPack(over: Partial<ProofPack> = {}): ProofPack {
  return {
    artifact: "proof-pack",
    id: "PP-SIQ-0042",
    subject: "grammar://health-mapping.v1",
    policyFingerprint: "sha256-abc123",
    source: { repo: "synapseiq", commit: "deadbeef", path: "packages/intell-agency" },
    checks: { iri: 0.2, gci: 0.1, tci: 0.15, dpBudgetRemaining: { epsilon: 1, delta: 0, windowDays: 30 } },
    witnesses: [{ type: "validator", hash: "sha256-" + "a".repeat(64), sig: "did:key:z6MkV" }],
    signatures: ["did:key:z6MkV"],
    merkleRoot: "sha256-" + "b".repeat(64),
    ...over,
  };
}

const opts = { epistemicLevel: "bounded" as EpistemicLevel, createdAt: "2026-08-03T00:00:00Z" };

test("mapped pack conforms to the canonical proof-pack schema", () => {
  const canonical = toCanonicalProofPack(localPack(), opts);
  const ok = validate(canonical);
  assert.equal(ok, true, JSON.stringify(validate.errors));
});

test("canonical mapping carries ledger head, epistemic, checks", () => {
  const c = toCanonicalProofPack(localPack(), opts);
  assert.equal(c.ledger.algo, "sha256");
  assert.match(c.ledger.head, /^[a-f0-9]{16,128}$/); // sha256- prefix stripped
  assert.equal(c.epistemic_level, "bounded");
  assert.equal(c.proof_pack_id.startsWith("proofpack_"), true);
  assert.ok(c.checks!.some((k) => k.name === "iri"));
  assert.ok(c.checks!.some((k) => k.name === "dp_budget_solvent"));
});

test("an unsigned pack cannot be mapped to a canonical pack", () => {
  assert.throws(() => toCanonicalProofPack(localPack({ signatures: [] }), opts), /signature/);
});

test("a negative DP budget maps to a failed solvency check", () => {
  const c = toCanonicalProofPack(
    localPack({ checks: { iri: 0.2, dpBudgetRemaining: { epsilon: -1, delta: 0, windowDays: 30 } } }),
    opts,
  );
  assert.equal(c.checks!.find((k) => k.name === "dp_budget_solvent")!.passed, false);
  assert.equal(validate(c), true, JSON.stringify(validate.errors)); // still schema-valid
});
