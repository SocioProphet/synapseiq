import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), 'utf8'));
}

test('envelope fixtures validate against schema artifact with Ajv', () => {
  const schema = readJson('packages/schemas/envelope.schema.json');
  const validFixture = readJson('tests/contract/fixtures/envelope.valid.json');
  const invalidFixture = readJson('tests/contract/fixtures/envelope.invalid.json');

  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);

  assert.equal(validate(validFixture), true);
  assert.equal(validate(invalidFixture), false);
});
