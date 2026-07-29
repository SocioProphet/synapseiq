#!/usr/bin/env node
/**
 * Assert every vendored copy of the column-glossary scorer is byte-identical to
 * the canonical source.
 *
 * The tabular-alpha services deploy standalone (Cloud Run source deploy, no
 * package.json in one of them), so the scorer is vendored rather than imported.
 * Vendoring only stays safe if the copies cannot drift — and drift is precisely
 * what produced the defect this consolidation removes: the enrichment package
 * was fixed to actually rank candidates while four service copies kept
 * returning `candidates[0]` with a hardcoded confidence of 0.5.
 *
 * Exit 0 when all copies match, 1 on any drift, 2 when the canonical source or
 * an expected copy is missing (could-not-check must never read as passed).
 */
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CANONICAL = join(ROOT, "services/_vendor/column-glossary-scoring.mjs");
const COPIES = [
  "services/tabular-alpha-api/column-glossary-scoring.mjs",
  "services/tabular-alpha-runtime/column-glossary-scoring.mjs",
];

const sha = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

if (!existsSync(CANONICAL)) {
  console.error(`ERR: canonical source missing: ${relative(ROOT, CANONICAL)}`);
  process.exit(2);
}

const want = sha(CANONICAL);
console.log(`canonical ${relative(ROOT, CANONICAL)} sha256:${want.slice(0, 16)}…`);

let drift = 0;
let missing = 0;
for (const rel of COPIES) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    console.error(`FAIL: expected vendored copy is missing: ${rel}`);
    missing++;
    continue;
  }
  const got = sha(abs);
  if (got === want) {
    console.log(`ok: ${rel}`);
  } else {
    console.error(`FAIL: ${rel} has drifted from the canonical source`);
    console.error(`      expected sha256:${want.slice(0, 16)}… got sha256:${got.slice(0, 16)}…`);
    drift++;
  }
}

if (missing) process.exit(2);
if (drift) {
  console.error(`\n${drift} vendored cop${drift === 1 ? "y has" : "ies have"} drifted. ` +
    `Re-copy services/_vendor/column-glossary-scoring.mjs over them.`);
  process.exit(1);
}
console.log("\nOK: all vendored scorer copies match the canonical source");
