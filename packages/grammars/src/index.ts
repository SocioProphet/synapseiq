// @socioprophet/synapseiq-grammars
//
// Versioned grammars and lowering for the SynapseIQ DSLs (grammar/LSP spec:
// docs/specs/grammar-lsp.md). This tranche (T7-18) lands the Mapping DSL:
// tree-sitter grammar source-of-truth plus the reference lowering to a durable
// internal representation. Enrichment-rule, semantic-query, and
// contract-authoring DSLs follow in their own slices.

export * from './mapping/ir.js';
export { tokenize } from './mapping/lexer.js';
export type { Token, TokenType } from './mapping/lexer.js';
export { parse } from './mapping/parser.js';
export type { ParseResult } from './mapping/parser.js';
export { lowerMapping, isValidMapping, hashMappingIR, MAPPING_GRAMMAR_VERSION } from './mapping/lower.js';
