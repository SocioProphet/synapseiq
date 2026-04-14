import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

function readJson(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

test('envelope schema exposes required top-level fields used by fixtures', () => {
  const schema = readJson('packages/schemas/envelope.schema.json');
  const validFixture = readJson('tests/contract/fixtures/envelope.valid.json');

  const required = new Set(schema.required ?? []);
  for (const key of ['envelope_version', 'record_kind', 'record_stage', 'record_id', 'record_ts', 'source', 'provenance', 'canonical']) {
    assert.equal(required.has(key), true, `schema should require ${key}`);
    assert.equal(key in validFixture, true, `fixture should include ${key}`);
  }
});
