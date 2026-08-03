#!/usr/bin/env node
// SynapseIQ Mapping DSL — CLI validation mode.
//
// Implements the grammar/LSP spec's "CLI validation mode for CI/CD": lints one
// or more `.sqmap` files and exits non-zero if any error-severity diagnostic is
// found. This is the fail-closed teeth for the lowering — it can be wired into
// pre-commit / CI to reject malformed mapping DSL at the door.
//
// Usage: synapseiq-mapping-lint <file.sqmap> [more.sqmap ...]

import { readFileSync } from 'node:fs';
import { lowerMapping } from './mapping/lower.js';

function main(argv: string[]): number {
  const files = argv.slice(2);
  if (files.length === 0) {
    process.stderr.write('usage: synapseiq-mapping-lint <file.sqmap> [...]\n');
    return 2;
  }

  let errorCount = 0;
  for (const file of files) {
    let src: string;
    try {
      src = readFileSync(file, 'utf8');
    } catch {
      process.stderr.write(`cannot read ${file}\n`);
      errorCount++;
      continue;
    }
    const doc = lowerMapping(src);
    for (const d of doc.diagnostics) {
      const loc = `${file}:${d.span.line + 1}:${d.span.col + 1}`;
      process.stderr.write(`${loc} ${d.severity} [${d.code}] ${d.message}\n`);
      if (d.severity === 'error') errorCount++;
    }
    if (doc.diagnostics.length === 0) {
      process.stdout.write(`${file}: ok (${doc.mappings.length} mapping(s), ${doc.irHash})\n`);
    }
  }
  return errorCount > 0 ? 1 : 0;
}

process.exit(main(process.argv));
