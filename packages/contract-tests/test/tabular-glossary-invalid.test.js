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

test('invalid tabular glossary fixture is missing required mapping inputs', () => {
  const doc = readJson('tests/contract/fixtures/tabular-glossary.invalid.json');
  assert.equal(typeof doc.table_name, 'string');
  assert.equal('column_name' in doc, false);
});
