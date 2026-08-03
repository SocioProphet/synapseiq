import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { test } from 'node:test';

import { lowerMapping, isValidMapping, MAPPING_GRAMMAR_VERSION } from '../src/index.js';
import type { LinkDecl, SourceMapping, TransformDecl } from '../src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (name: string): string => readFileSync(join(here, 'fixtures', name), 'utf8');

test('lowers the canonical identity_touch mapping to the durable IR', () => {
  const doc = lowerMapping(fixture('identity_touch.sqmap'));

  assert.equal(doc.kind, 'MappingDocument');
  assert.equal(doc.grammar, 'synapseiq-mapping');
  assert.equal(doc.grammarVersion, MAPPING_GRAMMAR_VERSION);
  assert.equal(doc.diagnostics.length, 0, JSON.stringify(doc.diagnostics, null, 2));
  assert.ok(isValidMapping(doc));

  assert.equal(doc.mappings.length, 1);
  const block = doc.mappings[0]!;
  assert.deepEqual(block.target.segments, ['vendor', 'identity-firmographic', 'identity_touch']);

  const sources = block.statements.filter((s): s is SourceMapping => s.kind === 'source');
  const transforms = block.statements.filter((s): s is TransformDecl => s.kind === 'transform');
  const links = block.statements.filter((s): s is LinkDecl => s.kind === 'link');
  assert.equal(sources.length, 3);
  assert.equal(transforms.length, 1);
  assert.equal(links.length, 1);

  assert.equal(sources[0]!.sourceField, 'company_name');
  assert.deepEqual(sources[0]!.target.segments, ['canonical', 'entity', 'organization', 'display_name']);

  assert.equal(transforms[0]!.field, 'company_domain');
  assert.equal(transforms[0]!.using, 'normalize_domain');

  const link = links[0]!;
  assert.deepEqual(link.from.segments, ['canonical', 'entity', 'organization']);
  assert.equal(link.to.prefix, 'fibo');
  assert.equal(link.to.local, 'Corporation');
  assert.ok(link.when);
  assert.equal(link.when!.field, 'industry');
  assert.equal(link.when!.op, 'in');
  assert.deepEqual(link.when!.values, ['banking', 'finance']);
});

test('IR hash is FIPS SHA-256 and formatting-invariant', () => {
  const doc = lowerMapping(fixture('identity_touch.sqmap'));
  assert.match(doc.irHash, /^sha256:[0-9a-f]{64}$/);

  // Same document lowered twice → identical hash (deterministic).
  const again = lowerMapping(fixture('identity_touch.sqmap'));
  assert.equal(doc.irHash, again.irHash);

  // Comments and whitespace do not change the semantic identity.
  const reformatted = [
    '// leading comment',
    'map vendor.identity-firmographic.identity_touch {',
    '',
    '    source company_name -> canonical.entity.organization.display_name',
    '    source person_name -> canonical.entity.person.display_name',
    '    source url -> canonical.event.page_url',
    '    transform company_domain using normalize_domain',
    '    link canonical.entity.organization to fibo:Corporation when industry in ["banking", "finance"]  # inline',
    '}',
  ].join('\n');
  assert.equal(lowerMapping(reformatted).irHash, doc.irHash);

  // A semantic change (different target) → different hash.
  const changed = fixture('identity_touch.sqmap').replace('normalize_domain', 'lowercase_domain');
  assert.notEqual(lowerMapping(changed).irHash, doc.irHash);
});

test('empty document lowers cleanly', () => {
  const doc = lowerMapping('   \n  # just a comment\n');
  assert.equal(doc.mappings.length, 0);
  assert.equal(doc.diagnostics.length, 0);
  assert.ok(isValidMapping(doc));
});

test('supports comparison-operator conditions on links', () => {
  const doc = lowerMapping(
    'map v.x { link canonical.entity.person to schema:Person when confidence >= 0.8 }',
  );
  assert.equal(doc.diagnostics.length, 0);
  const link = doc.mappings[0]!.statements[0] as LinkDecl;
  assert.equal(link.when!.op, '>=');
  assert.deepEqual(link.when!.values, ['0.8']);
});
