import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryEqualityGate, type Canonical, type Approx } from "../src/equality.ts";
import type { PurposeId } from "../src/governance.ts";

interface Acct { id: string; email: string }
const purpose = "purpose_identity_resolution" as PurposeId;

test("no merge finalizes WITHOUT a Canonical witness (silent merge forbidden)", () => {
  const gate = new InMemoryEqualityGate<Acct>();
  const { ticketId } = gate.requestMerge({ id: "a", email: "x@y" }, { id: "b", email: "x@y" }, purpose);
  assert.throws(() => gate.finalize(ticketId, (a) => a), /no Canonical<T> witness/);
});

test("witness must meet quorum, signatures must match quorum count and be non-empty", () => {
  const gate = new InMemoryEqualityGate<Acct>({ minQuorum: 3 });
  const { ticketId } = gate.requestMerge({ id: "a", email: "x@y" }, { id: "b", email: "x@y" }, purpose);
  // quorum below the gate minimum is rejected at finalize
  const twoSig: Canonical<Acct> = { proofUri: "object://p", hash: "sha256-1", quorum: 2, decidedAt: "2026-06-03T00:00:00Z", signatures: ["did:key:1", "did:key:2"] };
  gate.attachWitness(ticketId, twoSig);
  assert.throws(() => gate.finalize(ticketId, (a) => a), /quorum 2 < required 3/);
  // signatures count must equal declared quorum
  assert.throws(() => gate.attachWitness(ticketId, { ...twoSig, quorum: 3 }), /quorum must equal/);
  // empty signature rejected
  assert.throws(() => gate.attachWitness(ticketId, { ...twoSig, quorum: 2, signatures: ["did:key:1", ""] }), /MUST be signed/);
});

test("a quorum-meeting witnessed merge finalizes and records before/after for rollback", () => {
  const gate = new InMemoryEqualityGate<Acct>({ minQuorum: 3 });
  const approx: Approx<Acct> = { similarity: 0.82, method: "jaccard+email-domain", window: "30d" };
  const { ticketId } = gate.requestMerge({ id: "a", email: "x@y" }, { id: "b", email: "x@y" }, purpose, approx);
  gate.attachWitness(ticketId, { proofUri: "object://p", hash: "sha256-1", quorum: 3, decidedAt: "2026-06-03T00:00:00Z", signatures: ["did:key:1", "did:key:2", "did:key:3"] });
  const merged = gate.finalize(ticketId, (a, b) => ({ id: a.id, email: a.email, _from: [a.id, b.id] } as Acct));
  assert.equal(merged.id, "a");
  const t = gate.ticket(ticketId)!;
  assert.equal(t.status, "finalized");
  assert.deepEqual(t.diff!.before.map((x) => x.id), ["a", "b"]); // before/after recorded
  gate.rollback(ticketId);
  assert.equal(gate.ticket(ticketId)!.status, "rolledback"); // rollback path recorded
});
