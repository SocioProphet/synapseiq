const http = require('node:http');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 8080);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const PERSIST_BUCKET = process.env.PERSIST_BUCKET || '';

function now() {
  return new Date().toISOString();
}

function id() {
  return globalThis.crypto?.randomUUID?.() || `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function log(level, event, fields = {}) {
  if (!LOG_LEVEL) return;
  const entry = { ts: now(), level, event, ...fields };
  console.log(JSON.stringify(entry));
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function buildEnvelope(payload, requestId) {
  const candidates = Array.isArray(payload.glossary_candidates) ? payload.glossary_candidates : [];
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
      processor: 'tabular-alpha-runtime-hardened',
      method: 'rule'
    },
    confidence: { overall: candidates.length > 0 ? 0.5 : 0.1 },
    canonical: {
      mapping_type: 'column_to_glossary',
      target: candidates.length > 0 ? String(candidates[0]) : 'unmapped',
      source_fields: [String(payload.table_name), String(payload.column_name)],
      attributes: {
        column_description: payload.column_description ?? null,
        glossary_candidates: candidates
      }
    },
    source_native: payload,
    explanations: [
      {
        kind: 'rule',
        message: 'Selected the first glossary candidate when provided; otherwise emitted unmapped.',
        request_id: requestId
      }
    ]
  };
}

async function getAccessToken() {
  const url = 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token';
  const resp = await fetch(url, { headers: { 'Metadata-Flavor': 'Google' } });
  if (!resp.ok) {
    throw new Error(`metadata token request failed: ${resp.status}`);
  }
  const data = await resp.json();
  return data.access_token;
}

async function persistEnvelope(envelope) {
  if (!PERSIST_BUCKET) return { persisted: false, reason: 'no_bucket_configured' };
  const token = await getAccessToken();
  const objectName = `accepted/${new Date().toISOString().slice(0, 10)}/${envelope.record_id}.json`;
  const url = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(PERSIST_BUCKET)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify(envelope)
  });
  if (!resp.ok) {
    throw new Error(`persistence failed: ${resp.status}`);
  }
  return { persisted: true, object: objectName };
}

const server = http.createServer(async (req, res) => {
  const requestId = id();
  const startedAt = Date.now();

  if (req.method === 'GET' && (req.url === '/healthz' || req.url === '/health')) {
    log('info', 'healthz', { request_id: requestId });
    return sendJson(res, 200, { ok: true, service: 'tabular-alpha-runtime-hardened' });
  }

  if (req.method === 'GET' && req.url === '/readyz') {
    log('info', 'readyz', { request_id: requestId });
    return sendJson(res, 200, { ready: true });
  }

  if (req.method === 'GET' && req.url === '/') {
    return sendJson(res, 200, {
      service: 'tabular-alpha-runtime-hardened',
      endpoints: ['/healthz', '/readyz', '/ingest/tabular']
    });
  }

  if (req.method === 'POST' && req.url === '/ingest/tabular') {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk;
    }

    try {
      const doc = JSON.parse(raw || '{}');
      if (!doc.table_name || !doc.column_name) {
        log('warn', 'validation_failed', { request_id: requestId, reason: 'missing table_name or column_name' });
        return sendJson(res, 400, { error: 'missing table_name or column_name', request_id: requestId });
      }

      const envelope = buildEnvelope(doc, requestId);
      let persistence = { persisted: false };
      try {
        persistence = await persistEnvelope(envelope);
      } catch (err) {
        log('error', 'persist_failed', { request_id: requestId, error: String(err) });
      }

      log('info', 'ingest_accepted', {
        request_id: requestId,
        record_id: envelope.record_id,
        persisted: persistence.persisted,
        latency_ms: Date.now() - startedAt
      });

      return sendJson(res, 202, { accepted: true, request_id: requestId, persisted: persistence.persisted, envelopes: [envelope] });
    } catch (err) {
      log('error', 'invalid_json', { request_id: requestId, error: String(err) });
      return sendJson(res, 400, { error: 'invalid json', detail: String(err), request_id: requestId });
    }
  }

  log('warn', 'not_found', { request_id: requestId, method: req.method, path: req.url });
  return sendJson(res, 404, { error: 'not found', request_id: requestId });
});

server.listen(PORT, () => {
  log('info', 'startup', { port: PORT, persist_bucket: PERSIST_BUCKET || null });
});
