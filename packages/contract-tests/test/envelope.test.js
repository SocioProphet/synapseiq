import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, '../../../tests/contract/fixtures');

function readFixture(name) {
  const raw = fs.readFileSync(path.join(fixturesDir, name), 'utf8');
  return JSON.parse(raw);
}

function validateEnvelope(doc) {
  const requiredTopLevel = [
    'envelope_version',
    'record_kind',
    'record_stage',
    'record_id',
    'record_ts',
    'source',
    'provenance',
    'canonical',
  ];

  for (const key of requiredTopLevel) {
    if (!(key in doc)) {
      return { ok: false, reason: `Missing required field: ${key}` };
    }
  }

  if (doc.envelope_version !== '1.0.0') {
    return { ok: false, reason: 'Invalid envelope_version' };
  }

  const recordKinds = new Set(['event', 'entity', 'link', 'mapping', 'finding', 'activation']);
  if (!recordKinds.has(doc.record_kind)) {
    return { ok: false, reason: 'Invalid record_kind' };
  }

  const recordStages = new Set(['raw', 'normalized', 'enriched', 'validated', 'inferred', 'activated']);
  if (!recordStages.has(doc.record_stage)) {
    return { ok: false, reason: 'Invalid record_stage' };
  }

  if (!doc.source || typeof doc.source !== 'object') {
    return { ok: false, reason: 'Invalid source object' };
  }

  if (!doc.source.source_id || !doc.source.source_type) {
    return { ok: false, reason: 'Missing source identity fields' };
  }

  if (!doc.provenance || typeof doc.provenance !== 'object') {
    return { ok: false, reason: 'Invalid provenance object' };
  }

  for (const key of ['ingested_at', 'processed_at', 'processor', 'method']) {
    if (!(key in doc.provenance)) {
      return { ok: false, reason: `Missing provenance field: ${key}` };
    }
  }

  return { ok: true };
}

test('valid envelope fixture satisfies canonical envelope constraints', () => {
  const fixture = readFixture('envelope.valid.json');
  const result = validateEnvelope(fixture);
  assert.equal(result.ok, true, result.reason);
});

test('invalid envelope fixture fails canonical envelope constraints', () => {
  const fixture = readFixture('envelope.invalid.json');
  const result = validateEnvelope(fixture);
  assert.equal(result.ok, false);
  assert.match(result.reason, /record_kind/);
});
