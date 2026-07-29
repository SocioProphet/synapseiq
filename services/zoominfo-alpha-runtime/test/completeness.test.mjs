// Smoke tests for the ZoomInfo runtime's completeness-based confidence.
//
// The old envelopes stamped `confidence: { overall: 0.5 }` on every result.
// New confidence is derived from how many identifying anchors actually
// arrived in the payload. These tests pin that: an empty-anchor payload
// reports 0.0 with an explicit unmapped_reason instead of a comforting
// number; a fuller payload reports higher; the anchor bookkeeping matches
// what came in; and none of the paths report the old constant 0.5.
//
// server.js binds an HTTP port at import time. We extract the helper block
// into a temp CJS module so we can call the pure functions directly rather
// than round-trip through HTTP.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const SERVER = join(HERE, "..", "server.js");

const src = readFileSync(SERVER, "utf8");
const startIdx = src.indexOf("const EVIDENCE_ANCHORS");
const endIdx = src.indexOf("const server = http.createServer");
assert.ok(startIdx >= 0 && endIdx > startIdx, "helpers block not found");
const block = src.slice(startIdx, endIdx);

// Use mkdtempSync to get a private, unpredictable directory rather than a
// predictable filename in a shared /tmp — a symlink pre-created by another
// process could otherwise redirect the write. CodeQL flagged this class.
const shimDir = mkdtempSync(join(tmpdir(), "zoominfo-helpers-"));
const shimPath = join(shimDir, "helpers.cjs");
writeFileSync(shimPath, `
const id = () => 'rec_test';
const now = () => '2026-07-29T00:00:00Z';
${block}
module.exports = { completenessConfidence, buildEventEnvelope, buildOrgEnvelope, buildPersonEnvelope, EVIDENCE_ANCHORS };
`);
const helpers = require(shimPath);


test("empty payload for an entity gives 0.0 with an unmapped_reason", () => {
  const conf = helpers.completenessConfidence({}, "organization");
  assert.equal(conf.overall, 0);
  assert.equal(conf.evidence_type, "COMPLETENESS");
  assert.deepEqual(conf.anchors_present, []);
  assert.ok(conf.unmapped_reason);
});

test("confidence tracks anchor coverage — never the old constant 0.5", () => {
  const partial = helpers.completenessConfidence({ company_domain: "acme.com" }, "organization");
  const richer = helpers.completenessConfidence({
    company_domain: "acme.com",
    company_name: "Acme",
    company_industry: "widgets",
    employee_count: 42,
  }, "organization");
  assert.ok(partial.overall > 0 && partial.overall < richer.overall);
  assert.notEqual(partial.overall, 0.5);
  assert.notEqual(richer.overall, 0.5);
  assert.equal(richer.overall, 1);
});

test("anchors_present lists exactly what the payload actually carried", () => {
  const conf = helpers.completenessConfidence(
    { person_name: "Ada", person_email: "ada@example.com", junk_field: "ignored" },
    "person",
  );
  assert.deepEqual(conf.anchors_present.sort(), ["person_email", "person_name"]);
  assert.ok(!conf.anchors_present.includes("junk_field"));
});

test("blank strings do not count as an anchor being present", () => {
  const conf = helpers.completenessConfidence(
    { company_name: "   ", company_domain: "acme.com" },
    "organization",
  );
  assert.deepEqual(conf.anchors_present, ["company_domain"]);
});

test("event envelope embeds completeness confidence, no hardcoded 0.5", () => {
  const env = helpers.buildEventEnvelope({ page_url: "https://a" }, "req-1");
  assert.equal(env.confidence.evidence_type, "COMPLETENESS");
  assert.notEqual(env.confidence.overall, 0.5);
  assert.ok(env.confidence.overall > 0);
});

test("org envelope with only the boundary field reports low but nonzero confidence", () => {
  // company_name is BOTH the boundary requirement and an anchor, so it counts.
  // The other three anchors are absent, so confidence is 1/4 = 0.25.
  const env = helpers.buildOrgEnvelope({ company_name: "Acme" }, "req-2");
  assert.equal(env.confidence.overall, 0.25);
  assert.deepEqual(env.confidence.anchors_present, ["company_name"]);
  assert.equal(env.confidence.unmapped_reason, undefined,
               "one anchor present is not zero anchors — no unmapped_reason");
});

test("org envelope with truly zero anchors abstains", () => {
  // Payload the boundary would have rejected, but the helper is pure.
  const env = helpers.buildOrgEnvelope({}, "req-3");
  assert.equal(env.confidence.overall, 0);
  assert.ok(env.confidence.unmapped_reason);
});

test("EVIDENCE_ANCHORS: every kind states unique, non-empty anchors", () => {
  for (const [kind, anchors] of Object.entries(helpers.EVIDENCE_ANCHORS)) {
    assert.ok(anchors.length > 0, `${kind} declares no anchors`);
    assert.equal(new Set(anchors).size, anchors.length, `${kind} has duplicate anchors`);
  }
});

test("unknown kind is reported as a configuration error, not a payload defect", () => {
  const conf = helpers.completenessConfidence({ any: "value" }, "not-a-real-kind");
  assert.equal(conf.overall, 0);
  assert.match(conf.unmapped_reason, /unknown kind|configuration error/);
});
