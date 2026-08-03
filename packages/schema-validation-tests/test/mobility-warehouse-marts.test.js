import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../../..');

const STAGING = 'warehouse/models/staging/stg_mobility_signals.sql';
const MART_DIR = 'warehouse/models/mart';
// The mobility marts that materialize wedge-package outputs — each MUST enforce fail-closed
// suppression in SQL, or it could ship a suppressed signal into a customer-facing aggregate.
const MOBILITY_MARTS = [
  'mart_trade_area.sql',
  'mart_corridor_exposure.sql',
  'mart_event_impact.sql',
  'mart_site_fit.sql',
];

const read = (rel) => fs.readFileSync(path.join(repoRoot, rel), 'utf8');
// strip line comments so a "-- ... suppression_reason ..." remark can't satisfy the assertions.
const code = (rel) => read(rel).split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');

test('the mobility staging model exposes the computed privacy gates', () => {
  const sql = code(STAGING);
  for (const col of ['aggregation_floor_met', 'protected_location_excluded', 'raw_identifiers_present', 'suppression_reason']) {
    assert.ok(sql.includes(col), `stg_mobility_signals must expose ${col}`);
  }
});

for (const file of MOBILITY_MARTS) {
  test(`${file}: exists`, () => {
    assert.ok(fs.existsSync(path.join(repoRoot, MART_DIR, file)), `missing mart ${file}`);
  });

  test(`${file}: enforces the fail-closed privacy filter (suppression_reason is null)`, () => {
    const sql = code(`${MART_DIR}/${file}`).replace(/\s+/g, ' ').toLowerCase();
    assert.ok(
      sql.includes('suppression_reason is null'),
      `${file} must filter on 'suppression_reason is null' — a mart may not aggregate suppressed signals`,
    );
  });

  test(`${file}: sources from the mobility staging model`, () => {
    const sql = code(`${MART_DIR}/${file}`);
    assert.ok(sql.includes("ref('stg_mobility_signals')"), `${file} must source from stg_mobility_signals`);
  });
}
