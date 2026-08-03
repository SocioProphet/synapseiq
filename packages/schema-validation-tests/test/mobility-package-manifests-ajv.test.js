import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// package-manifest.v1 declares JSON Schema draft 2020-12 — use Ajv's 2020 dialect build
// (the default `ajv` export only knows draft-07).
import Ajv from 'ajv/dist/2020.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(repoRoot, rel), 'utf8'));
const readText = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');

const MANIFEST_DIR = 'packages/semantics/mobility/package-manifests';
// The two wedge packages this suite governs (SIQ-MOB-006/007).
const WEDGES = ['event_impact.v1.json', 'corridor_traffic_exposure.v1.json'];

const schema = readJson('packages/contracts/schemas/package-manifest.v1.schema.json');
const taxonomy = readText('packages/semantics/mobility/package-purpose-taxonomy.v1.yaml');
const contentLanes = readText('packages/semantics/mobility/content-lanes.v1.yaml');
const confidenceStrategies = readText('packages/semantics/mobility/confidence-strategies.v1.yaml');

const ajv = new Ajv({ allErrors: true, strict: false });
const validate = ajv.compile(schema);

test('both wedge manifest files are present', () => {
  const present = fs.readdirSync(path.join(repoRoot, MANIFEST_DIR)).filter((f) => f.endsWith('.json'));
  for (const w of WEDGES) assert.ok(present.includes(w), `missing wedge manifest ${w}`);
});

for (const file of WEDGES) {
  const manifest = readJson(`${MANIFEST_DIR}/${file}`);
  const fqid = `${manifest.package_id}.${manifest.version}`; // e.g. event_impact.v1

  test(`${fqid}: validates against package-manifest.v1 schema`, () => {
    assert.equal(validate(manifest), true, JSON.stringify(validate.errors, null, 2));
  });

  test(`${fqid}: is wired to a purpose in the taxonomy (no orphan package)`, () => {
    assert.ok(
      taxonomy.includes(fqid),
      `${fqid} does not appear in package-purpose-taxonomy allowed_for_packages`,
    );
  });

  test(`${fqid}: is a target of at least one content lane`, () => {
    assert.ok(contentLanes.includes(fqid), `${fqid} is not a package_target of any content lane`);
  });

  test(`${fqid}: references a defined confidence strategy (no dangling strategy)`, () => {
    assert.ok(
      confidenceStrategies.includes(`${manifest.confidence.strategy}:`),
      `confidence.strategy '${manifest.confidence.strategy}' is not defined in confidence-strategies.v1`,
    );
  });

  test(`${fqid}: holds the mobility privacy invariants (fail-closed)`, () => {
    assert.equal(manifest.privacy.raw_identifiers_allowed, false);
    assert.equal(manifest.privacy.suppress_protected_locations, true);
    assert.ok(manifest.privacy.min_subjects >= 1);
    // every blocked purpose the lane forbids must be present.
    for (const b of ['individual_targeting', 'restricted_audience_building', 'unapproved_investigative_use']) {
      assert.ok(manifest.purpose.blocked.includes(b), `${fqid} must block ${b}`);
    }
  });
}
