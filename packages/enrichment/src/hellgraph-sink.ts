import type { CanonicalEnvelope } from "@socioprophet/synapseiq-contracts";

export interface SinkResult {
  nodes: number;
  edges: number;
  errors: string[];
}

/** Minimal fetch shape — decoupled from DOM/node lib types so this package stays lib-agnostic + testable. */
export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number }>;

/**
 * Write enriched entity/link envelopes into HellGraph (via hellgraph-service HTTP) — SynapseIQ FEEDING the
 * knowledge graph, which is the "more than an LSP" opportunity: enrichment output becomes proof-carrying,
 * KKO-typed graph structure that new-hope / slash-topics / Holmes can then reason over. Entities → nodes
 * (epistemic_mode "observed", source synapseiq); links → edges by their normalized type. Fail-soft per
 * record: a bad write is collected in errors, the batch continues.
 */
export async function sinkToHellGraph(
  envelopes: CanonicalEnvelope[],
  opts: { hellgraphUrl: string; project?: string; fetchImpl?: FetchLike },
): Promise<SinkResult> {
  const f = opts.fetchImpl ?? ((globalThis as unknown as { fetch: FetchLike }).fetch);
  const base = opts.hellgraphUrl.replace(/\/$/, "");
  const coll = "proj-" + (opts.project ?? "synapseiq").replace(/-/g, "").slice(0, 12);
  const res: SinkResult = { nodes: 0, edges: 0, errors: [] };
  const nodeId = (id: string) => `${coll}:ent:${id}`;

  for (const env of envelopes) {
    const c = env.canonical as Record<string, unknown>;
    try {
      if (env.record_kind === "entity") {
        const name = String(c["normalized_name"] ?? c["display_name"] ?? env.record_id);
        const kko = String((c["attributes"] as Record<string, unknown> | undefined)?.["kko_class"] ?? "Particulars");
        const r = await f(`${base}/api/graph/node`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            id: nodeId(env.record_id),
            labels: [coll, "Entity"],
            properties: {
              name,
              epistemic_mode: "observed",
              source: `synapseiq:${env.source.source_id}`,
              extractor: "synapseiq-enrichment/rule-v0",
              kko_type: kko,
              entity_type: c["entity_type"] ?? null,
            },
          }),
        });
        if (r.ok) res.nodes++;
        else res.errors.push(`node ${env.record_id}: HTTP ${r.status}`);
      } else if (env.record_kind === "link") {
        const from = nodeId(String(c["from_entity_id"]));
        const to = nodeId(String(c["to_entity_id"]));
        const label = String(c["link_type"] ?? "RELATED_TO");
        const r = await f(`${base}/api/graph/edge`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            label,
            from,
            to,
            properties: {
              epistemic_mode: "observed",
              source: `synapseiq:${env.source.source_id}`,
              extractor: "synapseiq-enrichment/rule-v0",
            },
          }),
        });
        if (r.ok) res.edges++;
        else res.errors.push(`edge ${env.record_id}: HTTP ${r.status}`);
      }
    } catch (e) {
      res.errors.push(`${env.record_id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  return res;
}
