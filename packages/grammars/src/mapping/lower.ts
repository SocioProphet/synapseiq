// SynapseIQ Mapping DSL — lowering entrypoint.
//
// Lowers Mapping DSL source text into a durable `MappingDocument` IR. This is
// the "tree-sitter lowering" step: source → syntax → typed, serializable IR
// that downstream tooling consumes without re-parsing. Until the native
// tree-sitter parser is generated from `grammar.js`, this hand-written
// recursive-descent parser is the reference lowering; both share the same node
// vocabulary and produce the same IR shape.

import { createHash } from 'node:crypto';
import type { MappingBlock, MappingDocument } from './ir.js';
import { parse } from './parser.js';

/** Grammar version — kept in lockstep with tree-sitter-synapseiq-mapping/grammar.json. */
export const MAPPING_GRAMMAR_VERSION = '0.1.0';

/**
 * Compute a stable, FIPS-compliant (SHA-256) content hash over the lowered
 * structure. Diagnostics and the hash field are excluded so that the same
 * semantic mapping always yields the same identity regardless of authoring
 * whitespace or comments. Returns `sha256:<hex>`.
 */
export function hashMappingIR(mappings: MappingBlock[]): string {
  const canonical = JSON.stringify(mappings, canonicalReplacer);
  const digest = createHash('sha256').update(canonical, 'utf8').digest('hex');
  return `sha256:${digest}`;
}

// Drop volatile `span` metadata from the hash input: two documents that differ
// only in formatting must hash identically. Semantics live outside the spans.
function canonicalReplacer(key: string, value: unknown): unknown {
  if (key === 'span') return undefined;
  return value;
}

/** Lower Mapping DSL source into the durable IR. Never throws. */
export function lowerMapping(src: string): MappingDocument {
  const { mappings, diagnostics } = parse(src);
  return {
    kind: 'MappingDocument',
    grammar: 'synapseiq-mapping',
    grammarVersion: MAPPING_GRAMMAR_VERSION,
    mappings,
    diagnostics,
    irHash: hashMappingIR(mappings),
  };
}

/** Convenience: true when the document lowered with no error-severity diagnostics. */
export function isValidMapping(doc: MappingDocument): boolean {
  return !doc.diagnostics.some((d) => d.severity === 'error');
}
