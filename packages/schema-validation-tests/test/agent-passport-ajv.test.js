import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

test('agent-passport enrichment fixtures validate against schema with Ajv', () => {
  const schema = readJson('packages/schemas/agent-passport.schema.json');
  const validFixture = readJson('tests/contract/fixtures/agent-passport.valid.json');
  const invalidFixture = readJson('tests/contract/fixtures/agent-passport.invalid.json');

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  assert.equal(validate(validFixture), true);
  // invalid: unclassified agent_class, confidence > 1, bad classification_method
  assert.equal(validate(invalidFixture), false);
});
