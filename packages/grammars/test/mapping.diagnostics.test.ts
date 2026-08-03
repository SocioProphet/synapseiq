import assert from 'node:assert/strict';
import { test } from 'node:test';

import { lowerMapping } from '../src/index.js';
import type { Diagnostic } from '../src/index.js';

const codes = (diags: Diagnostic[]): string[] => diags.map((d) => d.code);

test('missing -> in a source statement is reported', () => {
  const doc = lowerMapping('map v.x { source company_name canonical.entity.organization.display_name }');
  assert.ok(codes(doc.diagnostics).includes('mapping/expected-arrow'), JSON.stringify(doc.diagnostics));
});

test('missing { after target is reported', () => {
  const doc = lowerMapping('map v.x source a -> b');
  assert.ok(codes(doc.diagnostics).includes('mapping/expected-lbrace'));
});

test('unterminated block is reported', () => {
  const doc = lowerMapping('map v.x {\n  source a -> canonical.b\n');
  assert.ok(codes(doc.diagnostics).includes('mapping/unterminated-block'));
});

test('unterminated string is reported', () => {
  const doc = lowerMapping('map v.x { link a to fibo:Corp when industry in ["banking] }');
  assert.ok(doc.diagnostics.length > 0);
});

test('unknown statement keyword is reported', () => {
  const doc = lowerMapping('map v.x { frobnicate a -> b }');
  assert.ok(codes(doc.diagnostics).includes('mapping/unknown-statement'));
});

test('error tolerance: a broken statement does not blank out later valid ones', () => {
  const src = [
    'map v.x {',
    '  source good_one -> canonical.entity.organization.display_name',
    '  transform', // broken: no field / using
    '  source good_two -> canonical.event.page_url',
    '}',
  ].join('\n');
  const doc = lowerMapping(src);
  assert.ok(doc.diagnostics.length > 0);
  const sources = doc.mappings[0]!.statements.filter((s) => s.kind === 'source');
  // Both well-formed source statements survive the broken transform in between.
  assert.equal(sources.length, 2);
});

test('error tolerance: a broken block does not blank out a later valid block', () => {
  const src = ['map v.x source a -> b', 'map v.y { source c -> canonical.d }'].join('\n\n');
  const doc = lowerMapping(src);
  assert.ok(doc.diagnostics.length > 0);
  // The second, well-formed block is still lowered.
  assert.ok(doc.mappings.some((m) => m.target.text === 'v.y'));
});

test('CURIE requires a local part', () => {
  const doc = lowerMapping('map v.x { link a to fibo }');
  assert.ok(codes(doc.diagnostics).includes('mapping/expected-curie'));
});
