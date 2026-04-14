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

function validateAgainstEnvelopeSchema(doc, schema) {
  const issues = [];

  for (const key of schema.required ?? []) {
    if (!(key in doc)) {
      issues.push(`missing required field: ${key}`);
    }
  }

  for (const [key, spec] of Object.entries(schema.properties ?? {})) {
    if (!(key in doc)) continue;
    const value = doc[key];

    if (spec.const !== undefined && value !== spec.const) {
      issues.push(`${key} must equal ${spec.const}`);
    }

    if (spec.enum && !spec.enum.includes(value)) {
      issues.push(`${key} must be one of ${spec.enum.join(',')}`);
    }

    if (spec.type === 'object' && value !== null && typeof value !== 'object') {
      issues.push(`${key} must be an object`);
    }

    if (Array.isArray(spec.type) && !spec.type.some((t) => (t === 'null' ? value === null : typeof value === t))) {
      issues.push(`${key} does not match any allowed types`);
    }
  }

  return issues;
}

test('valid fixture satisfies envelope schema artifact constraints', () => {
  const schema = readJson('packages/schemas/envelope.schema.json');
  const doc = readJson('tests/contract/fixtures/envelope.valid.json');
  const issues = validateAgainstEnvelopeSchema(doc, schema);
  assert.deepEqual(issues, []);
});

test('invalid fixture violates envelope schema artifact constraints', () => {
  const schema = readJson('packages/schemas/envelope.schema.json');
  const doc = readJson('tests/contract/fixtures/envelope.invalid.json');
  const issues = validateAgainstEnvelopeSchema(doc, schema);
  assert.equal(issues.some((x) => x.includes('record_kind')), true);
});
