const http = require('node:http');

const PORT = Number(process.env.PORT || 8080);
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

function now() {
  return new Date().toISOString();
}

function id() {
  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function log(level, event, fields = {}) {
  if (!LOG_LEVEL) return;
  console.log(JSON.stringify({ ts: now(), level, event, ...fields }));
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function buildEventEnvelope(payload, requestId) {
  return {
    envelope_version: '1.0.0',
    record_kind: 'event',
    record_stage: 'normalized',
    record_id: id(),
    record_ts: now(),
    source: { source_id: 'zoominfo', source_type: 'sync_api' },
    provenance: {
      ingested_at: now(),
      processed_at: now(),
      processor: 'zoominfo-alpha-runtime',
      method: 'rule'
    },
    confidence: { overall: 0.5 },
    canonical: {
      event_type: 'zoominfo_identity_touch',
      attributes: {
        page_url: payload.page_url || null,
        company_domain: payload.company_domain || null
      }
    },
    source_native: payload,
    explanations: [{ kind: 'rule', message: 'Normalized ZoomInfo-style payload into event envelope', request_id: requestId }]
  };
}

function buildOrgEnvelope(payload, requestId) {
  return {
    envelope_version: '1.0.0',
    record_kind: 'entity',
    record_stage: 'normalized',
    record_id: id(),
    record_ts: now(),
    source: { source_id: 'zoominfo', source_type: 'sync_api' },
    provenance: {
      ingested_at: now(),
      processed_at: now(),
      processor: 'zoominfo-alpha-runtime',
      method: 'rule'
    },
    confidence: { overall: 0.5 },
    canonical: {
      entity_type: 'organization',
      display_name: payload.company_name,
      normalized_name: payload.company_domain || payload.company_name,
      attributes: {
        company_domain: payload.company_domain || null
      }
    },
    source_native: payload,
    explanations: [{ kind: 'rule', message: 'Extracted organization entity from ZoomInfo-style payload', request_id: requestId }]
  };
}

function buildPersonEnvelope(payload, requestId) {
  return {
    envelope_version: '1.0.0',
    record_kind: 'entity',
    record_stage: 'normalized',
    record_id: id(),
    record_ts: now(),
    source: { source_id: 'zoominfo', source_type: 'sync_api' },
    provenance: {
      ingested_at: now(),
      processed_at: now(),
      processor: 'zoominfo-alpha-runtime',
      method: 'rule'
    },
    confidence: { overall: 0.5 },
    canonical: {
      entity_type: 'person',
      display_name: payload.person_name,
      normalized_name: payload.person_name
    },
    source_native: payload,
    explanations: [{ kind: 'rule', message: 'Extracted person entity from ZoomInfo-style payload', request_id: requestId }]
  };
}

const server = http.createServer(async (req, res) => {
  const requestId = id();

  if (req.method === 'GET' && req.url === '/health') {
    log('info', 'health', { request_id: requestId });
    return sendJson(res, 200, { ok: true, service: 'zoominfo-alpha-runtime' });
  }

  if (req.method === 'GET' && req.url === '/ready') {
    log('info', 'ready', { request_id: requestId });
    return sendJson(res, 200, { ready: true });
  }

  if (req.method === 'POST' && req.url === '/ingest/zoominfo') {
    let raw = '';
    for await (const chunk of req) raw += chunk;

    try {
      const doc = JSON.parse(raw || '{}');
      if (!doc.company_name && !doc.person_name) {
        log('warn', 'validation_failed', { request_id: requestId, reason: 'missing company_name and person_name' });
        return sendJson(res, 400, { error: 'missing company_name and person_name', request_id: requestId });
      }

      const envelopes = [buildEventEnvelope(doc, requestId)];
      if (doc.company_name) envelopes.push(buildOrgEnvelope(doc, requestId));
      if (doc.person_name) envelopes.push(buildPersonEnvelope(doc, requestId));

      log('info', 'ingest_accepted', { request_id: requestId, envelope_count: envelopes.length });
      return sendJson(res, 202, { accepted: true, request_id: requestId, envelopes });
    } catch (err) {
      log('error', 'invalid_json', { request_id: requestId, error: String(err) });
      return sendJson(res, 400, { error: 'invalid json', detail: String(err), request_id: requestId });
    }
  }

  log('warn', 'not_found', { request_id: requestId, method: req.method, path: req.url });
  return sendJson(res, 404, { error: 'not found', request_id: requestId });
});

server.listen(PORT, () => {
  log('info', 'startup', { port: PORT });
});
