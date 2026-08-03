import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

// Guard against the "reasoning package_id drifts from a registered package" class of bug
// (the corridor_exposure.v1 vs corridor_traffic_exposure.v1 mismatch that shipped and had to be
// fixed after the fact). Every package_id a reasoning module emits MUST resolve to a registered
// package: one listed in the purpose taxonomy's allowed_for_packages, OR one with a PackageManifest.
// Otherwise the module labels its results with a product id nothing else in the estate knows about.

const REASONING_SRC = path.join(repoRoot, 'packages/reasoning/src');
const taxonomy = fs.readFileSync(
  path.join(repoRoot, 'packages/semantics/mobility/package-purpose-taxonomy.v1.yaml'),
  'utf8',
);
const manifestDir = path.join(repoRoot, 'packages/semantics/mobility/package-manifests');
const manifestIds = new Set(
  fs
    .readdirSync(manifestDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.replace(/\.json$/, '')), // e.g. event_impact.v1
);

/** Every `package_id: "X.v1"` literal emitted anywhere in the reasoning package, with its file. */
function emittedPackageIds() {
  const found = [];
  for (const file of fs.readdirSync(REASONING_SRC)) {
    if (!file.endsWith('.ts') || file.endsWith('.d.ts')) continue;
    const src = fs.readFileSync(path.join(REASONING_SRC, file), 'utf8');
    for (const m of src.matchAll(/package_id:\s*"([^"]+)"/g)) found.push({ id: m[1], file });
  }
  return found;
}

// A package is registered if the taxonomy references its fully-qualified id, or a manifest exists.
const isRegistered = (id) => taxonomy.includes(id) || manifestIds.has(id);

test('reasoning modules actually emit at least one package_id (guard is not vacuous)', () => {
  assert.ok(emittedPackageIds().length > 0, 'no package_id literals found — did the scan path change?');
});

test('every reasoning package_id resolves to a registered package (taxonomy or manifest)', () => {
  const orphans = emittedPackageIds().filter((p) => !isRegistered(p.id));
  assert.deepEqual(
    orphans,
    [],
    `reasoning package_id(s) not registered in the purpose taxonomy or as a PackageManifest: ` +
      orphans.map((o) => `${o.id} (${o.file})`).join(', '),
  );
});
