// SynapseIQ Mapping DSL — durable internal representation (IR).
//
// This is the "lowered" form the grammar/LSP spec requires:
//   "DSLs must compile to durable internal representations."
// The IR is a stable, serializable tree that downstream tooling (LSP
// diagnostics, transformation planner, contract validator) consumes without
// re-parsing source text. Every node carries a source `span` so tooling can map
// IR back to editor positions.

/** Source position span. `line`/`col` are 0-based to match the SynapseIQ LSP wire format. */
export interface Span {
  line: number;
  col: number;
  endLine: number;
  endCol: number;
  /** Absolute character offset of the first character. */
  offset: number;
  /** Length in characters. */
  length: number;
}

export type Severity = 'error' | 'warning';

export interface Diagnostic {
  severity: Severity;
  /** Stable machine code, e.g. `mapping/expected-arrow`. */
  code: string;
  message: string;
  span: Span;
}

/** A dotted path such as `canonical.entity.organization.display_name`. */
export interface QualifiedPath {
  segments: string[];
  text: string;
  span: Span;
}

/** A compact URI reference such as `fibo:Corporation`. */
export interface Curie {
  prefix: string;
  local: string;
  text: string;
  span: Span;
}

export type ConditionOp = 'in' | '==' | '!=' | '>' | '<' | '>=' | '<=';

export interface Condition {
  field: string;
  op: ConditionOp;
  /** String/number literals (as text). For `in`, the list members. */
  values: string[];
  span: Span;
}

export interface SourceMapping {
  kind: 'source';
  sourceField: string;
  target: QualifiedPath;
  span: Span;
}

export interface TransformDecl {
  kind: 'transform';
  field: string;
  using: string;
  span: Span;
}

export interface LinkDecl {
  kind: 'link';
  from: QualifiedPath;
  to: Curie;
  when?: Condition;
  span: Span;
}

export type MappingStatement = SourceMapping | TransformDecl | LinkDecl;

export interface MappingBlock {
  kind: 'mapping';
  target: QualifiedPath;
  statements: MappingStatement[];
  span: Span;
}

export interface MappingDocument {
  kind: 'MappingDocument';
  /** Grammar identity — matches the tree-sitter grammar name. */
  grammar: 'synapseiq-mapping';
  /** Grammar version, kept in lockstep with `tree-sitter-synapseiq-mapping/grammar.json`. */
  grammarVersion: string;
  mappings: MappingBlock[];
  diagnostics: Diagnostic[];
  /**
   * FIPS-compliant SHA-256 content hash of the lowered structure (excluding
   * diagnostics and the hash itself). Gives the IR a durable, comparable
   * identity for provenance and caching. Format: `sha256:<hex>`.
   */
  irHash: string;
}
