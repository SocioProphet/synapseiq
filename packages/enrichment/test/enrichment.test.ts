/** enrichment — real enrichEnvelope + the HellGraph sink. Run: tsx (node:test). */
import { test } from "node:test";
import assert from "node:assert/strict";
import type { CanonicalEnvelope } from "@socioprophet/synapseiq-contracts";
import { enrichEnvelope, kkoClassOf, normalizeToken, normalizeName } from "../src/index.js";
import { sinkToHellGraph, type FetchLike } from "../src/hellgraph-sink.js";

function envelope(kind: CanonicalEnvelope["record_kind"], canonical: Record<string, unknown>, id = "r1"): CanonicalEnvelope {
  return {
    envelope_version: "1.0.0",
    record_kind: kind,
    record_stage: "normalized",
    record_id: id,
    record_ts: "2026-07-17T00:00:00Z",
    source: { source_id: "src-A", source_type: "test" },
    provenance: { ingested_at: "2026-07-17T00:00:00Z", processed_at: "2026-07-17T00:00:00Z", processor: "raw", method: "rule" },
    canonical,
  };
}

test("enrichEnvelope: entity gets normalized_name + KKO class + enriched stage + provenance", () => {
  const out = enrichEnvelope(envelope("entity", { entity_type: "organization", display_name: "  ACME  Corp. " }));
  assert.equal(out.record_stage, "enriched");
  assert.equal((out.canonical as Record<string, unknown>)["normalized_name"], "acme corp");
  assert.equal(((out.canonical as Record<string, unknown>)["attributes"] as Record<string, unknown>)["kko_class"], "Particulars");
  assert.equal(out.provenance.processor, "synapseiq-enrichment");
  assert.equal(out.confidence?.overall, 0.95); // mean(1, 0.9)
  assert.ok(out.explanations?.some((e) => (e as Record<string, unknown>)["enricher"] === "synapseiq-enrichment/rule-v0"));
});

test("enrichEnvelope: link_type normalized to UPPER_SNAKE", () => {
  const out = enrichEnvelope(envelope("link", { link_type: "works at", from_entity_id: "a", to_entity_id: "b" }));
  assert.equal((out.canonical as Record<string, unknown>)["link_type"], "WORKS_AT");
});

test("kkoClassOf aligns to Peircean categories", () => {
  assert.equal(kkoClassOf("concept"), "Generals");
  assert.equal(kkoClassOf("quality"), "Possibilities");
  assert.equal(kkoClassOf("person"), "Particulars");
  assert.equal(normalizeToken("co-occurs with"), "CO_OCCURS_WITH");
  assert.equal(normalizeName("  The Café! "), "the café");
});

test("sinkToHellGraph writes entities → nodes and links → edges with provenance", async () => {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fake: FetchLike = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200 }; };
  const ents = [
    enrichEnvelope(envelope("entity", { entity_type: "org", display_name: "ACME" }, "e1")),
    enrichEnvelope(envelope("link", { link_type: "supports", from_entity_id: "e1", to_entity_id: "e2" }, "l1")),
  ];
  const res = await sinkToHellGraph(ents, { hellgraphUrl: "http://hg:8090", project: "team-x", fetchImpl: fake });
  assert.equal(res.nodes, 1);
  assert.equal(res.edges, 1);
  assert.equal(res.errors.length, 0);
  // node carries proof-carrying provenance + KKO type
  const nodeCall = calls.find((c) => c.url.endsWith("/api/graph/node"))!;
  assert.equal((nodeCall.body["properties"] as Record<string, unknown>)["epistemic_mode"], "observed");
  assert.equal((nodeCall.body["properties"] as Record<string, unknown>)["kko_type"], "Particulars");
  assert.ok(String((nodeCall.body["properties"] as Record<string, unknown>)["source"]).startsWith("synapseiq:"));
  // edge label is the normalized token
  const edgeCall = calls.find((c) => c.url.endsWith("/api/graph/edge"))!;
  assert.equal(edgeCall.body["label"], "SUPPORTS");
});
