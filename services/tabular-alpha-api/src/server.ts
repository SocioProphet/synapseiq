import http from 'node:http';
import { mapColumnToGlossary } from '../column-glossary-scoring.mjs';

const PORT = Number(process.env.PORT ?? 8080);

function now() {
  return new Date().toISOString();
}

function id() {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function sendJson(res: http.ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function buildEnvelope(payload: Record<string, unknown>) {
  // Real scoring via the vendored scorer. These services previously returned
  // candidates[0] with confidence 0.5 — the caller did the mapping and the
  // number meant nothing. Abstains rather than force-matching.
  const candidates = Array.isArray(payload.glossary_candidates)
    ? payload.glossary_candidates.filter((c) => typeof c === 'string' && c.trim().length > 0)
    : [];
  const mapping = mapColumnToGlossary(String(payload.column_name), candidates);
  return {
    envelope_version: '1.0.0',
    record_kind: 'mapping',
    record_stage: 'normalized',
    record_id: id(),
    record_ts: now(),
    source: { source_id: 'tabular-glossary', source_type: 'sync_api' },
    provenance: {
      ingested_at: now(),
      processed_at: now(),
      processor: 'tabular-alpha-api',
      method: 'rule'
    },
    confidence: { overall: mapping.confidence },
    canonical: {
      mapping_type: 'column_to_glossary',
      target: mapping.target ?? 'unmapped',
      expanded_column: mapping.expandedColumn,
      expansions_applied: mapping.expansionsApplied,
      evidence_type: 'LEXICAL',
      ranked_candidates: mapping.ranked,
      ...(mapping.unmappedReason ? { unmapped_reason: mapping.unmappedReason } : {}),
      source_fields: [String(payload.table_name), String(payload.column_name)]
    },
    source_native: payload
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && req.url === '/readyz') {
    return sendJson(res, 200, { ready: true });
  }

  if (req.method === 'POST' && req.url === '/ingest/tabular') {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
    }

    try {
      const doc = JSON.parse(raw || '{}');
      if (!doc.table_name || !doc.column_name) {
        return sendJson(res, 400, { error: 'missing table_name or column_name' });
      }
      return sendJson(res, 202, { accepted: true, envelopes: [buildEnvelope(doc)] });
    } catch (err) {
      return sendJson(res, 400, { error: 'invalid json', detail: String(err) });
    }
  }

  return sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`tabular-alpha-api listening on :${PORT}`);
});
