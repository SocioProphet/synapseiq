// SynapseIQ Mapping DSL — recursive-descent parser.
//
// Consumes the token stream and produces IR blocks plus diagnostics. The parser
// is error-tolerant: on an unexpected token it records a diagnostic and recovers
// to the next statement or block boundary rather than aborting, so a single
// authoring mistake never blanks out the whole document.

import type { Token, TokenType } from './lexer.js';
import { tokenize } from './lexer.js';
import type {
  Condition,
  ConditionOp,
  Curie,
  Diagnostic,
  LinkDecl,
  MappingBlock,
  MappingStatement,
  QualifiedPath,
  SourceMapping,
  Span,
  TransformDecl,
} from './ir.js';

const STATEMENT_KEYWORDS: TokenType[] = ['source', 'transform', 'link'];

export interface ParseResult {
  mappings: MappingBlock[];
  diagnostics: Diagnostic[];
}

class Parser {
  private readonly tokens: Token[];
  private pos = 0;
  readonly diagnostics: Diagnostic[] = [];

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token {
    return this.tokens[this.pos] ?? this.tokens[this.tokens.length - 1]!;
  }

  private next(): Token {
    const t = this.peek();
    if (this.pos < this.tokens.length - 1) this.pos++;
    return t;
  }

  private atEnd(): boolean {
    return this.peek().type === 'eof';
  }

  private diag(code: string, message: string, span: Span, severity: 'error' | 'warning' = 'error'): void {
    this.diagnostics.push({ severity, code, message, span });
  }

  /** Merge two spans into one covering both. */
  private static join(a: Span, b: Span): Span {
    return {
      line: a.line,
      col: a.col,
      endLine: b.endLine,
      endCol: b.endCol,
      offset: a.offset,
      length: Math.max(a.offset + a.length, b.offset + b.length) - a.offset,
    };
  }

  parseDocument(): MappingBlock[] {
    const blocks: MappingBlock[] = [];
    while (!this.atEnd()) {
      if (this.peek().type === 'map') {
        const block = this.parseMappingBlock();
        if (block) blocks.push(block);
      } else {
        const tok = this.next();
        this.diag(
          'mapping/unexpected-top-level',
          `Expected 'map' at top level, found '${tok.value || tok.type}'`,
          tok.span,
        );
      }
    }
    return blocks;
  }

  private parseMappingBlock(): MappingBlock | null {
    const mapKw = this.next(); // 'map'
    const target = this.parsePath();
    if (!target) {
      this.diag('mapping/expected-target', "Expected a target path after 'map'", mapKw.span);
      this.recoverToBlockEnd();
      return null;
    }

    if (this.peek().type !== 'lbrace') {
      this.diag('mapping/expected-lbrace', "Expected '{' to open the mapping block", this.peek().span);
      this.recoverToBlockEnd();
      return null;
    }
    this.next(); // '{'

    const statements: MappingStatement[] = [];
    while (!this.atEnd() && this.peek().type !== 'rbrace') {
      const before = this.pos;
      const stmt = this.parseStatement();
      if (stmt) statements.push(stmt);
      // Guarantee forward progress even if a statement parser bailed early.
      if (this.pos === before) this.next();
    }

    let endSpan = this.peek().span;
    if (this.peek().type === 'rbrace') {
      endSpan = this.next().span;
    } else {
      this.diag('mapping/unterminated-block', "Expected '}' to close the mapping block", endSpan);
    }

    return {
      kind: 'mapping',
      target,
      statements,
      span: Parser.join(mapKw.span, endSpan),
    };
  }

  private parseStatement(): MappingStatement | null {
    const t = this.peek();
    switch (t.type) {
      case 'source':
        return this.parseSource();
      case 'transform':
        return this.parseTransform();
      case 'link':
        return this.parseLink();
      default: {
        const tok = this.next();
        this.diag(
          'mapping/unknown-statement',
          `Expected 'source', 'transform', or 'link', found '${tok.value || tok.type}'`,
          tok.span,
        );
        this.recoverToStatement();
        return null;
      }
    }
  }

  private parseSource(): SourceMapping | null {
    const kw = this.next(); // 'source'
    const field = this.expectIdent('mapping/expected-source-field', 'Expected a source field name');
    if (!field) {
      this.recoverToStatement();
      return null;
    }
    if (this.peek().type !== 'arrow') {
      this.diag('mapping/expected-arrow', "Expected '->' after the source field", this.peek().span);
      this.recoverToStatement();
      return null;
    }
    this.next(); // '->'
    const target = this.parsePath();
    if (!target) {
      this.diag('mapping/expected-target-path', "Expected a canonical target path after '->'", this.peek().span);
      this.recoverToStatement();
      return null;
    }
    return { kind: 'source', sourceField: field.value, target, span: Parser.join(kw.span, target.span) };
  }

  private parseTransform(): TransformDecl | null {
    const kw = this.next(); // 'transform'
    const field = this.expectIdent('mapping/expected-transform-field', 'Expected a field name to transform');
    if (!field) {
      this.recoverToStatement();
      return null;
    }
    if (this.peek().type !== 'using') {
      this.diag('mapping/expected-using', "Expected 'using' after the transform field", this.peek().span);
      this.recoverToStatement();
      return null;
    }
    this.next(); // 'using'
    const fn = this.expectIdent('mapping/expected-transform-fn', "Expected a transform function name after 'using'");
    if (!fn) {
      this.recoverToStatement();
      return null;
    }
    return { kind: 'transform', field: field.value, using: fn.value, span: Parser.join(kw.span, fn.span) };
  }

  private parseLink(): LinkDecl | null {
    const kw = this.next(); // 'link'
    const from = this.parsePath();
    if (!from) {
      this.diag('mapping/expected-link-source', "Expected a source path after 'link'", this.peek().span);
      this.recoverToStatement();
      return null;
    }
    if (this.peek().type !== 'to') {
      this.diag('mapping/expected-to', "Expected 'to' in link statement", this.peek().span);
      this.recoverToStatement();
      return null;
    }
    this.next(); // 'to'
    const to = this.parseCurie();
    if (!to) {
      this.diag('mapping/expected-curie', "Expected a CURIE (e.g. fibo:Corporation) after 'to'", this.peek().span);
      this.recoverToStatement();
      return null;
    }
    let when: Condition | undefined;
    let endSpan: Span = to.span;
    if (this.peek().type === 'when') {
      const cond = this.parseCondition();
      if (cond) {
        when = cond;
        endSpan = cond.span;
      }
    }
    const link: LinkDecl = { kind: 'link', from, to, span: Parser.join(kw.span, endSpan) };
    if (when) link.when = when;
    return link;
  }

  private parseCondition(): Condition | null {
    const whenKw = this.next(); // 'when'
    const field = this.expectIdent('mapping/expected-condition-field', "Expected a field name after 'when'");
    if (!field) {
      this.recoverToStatement();
      return null;
    }
    const opTok = this.peek();
    if (opTok.type === 'in') {
      this.next();
      if (this.peek().type !== 'lbracket') {
        this.diag('mapping/expected-lbracket', "Expected '[' to open the value list after 'in'", this.peek().span);
        this.recoverToStatement();
        return null;
      }
      this.next(); // '['
      const values: string[] = [];
      let endSpan = opTok.span;
      while (!this.atEnd() && this.peek().type !== 'rbracket') {
        const v = this.peek();
        if (v.type === 'string' || v.type === 'number' || v.type === 'ident') {
          values.push(v.value);
          this.next();
        } else if (v.type === 'comma') {
          this.next();
        } else {
          this.diag('mapping/invalid-list-item', `Unexpected '${v.value || v.type}' in value list`, v.span);
          this.next();
        }
      }
      if (this.peek().type === 'rbracket') {
        endSpan = this.next().span;
      } else {
        this.diag('mapping/unterminated-list', "Expected ']' to close the value list", this.peek().span);
      }
      return { field: field.value, op: 'in', values, span: Parser.join(whenKw.span, endSpan) };
    }

    if (opTok.type === 'op') {
      this.next();
      const v = this.peek();
      if (v.type === 'string' || v.type === 'number' || v.type === 'ident') {
        this.next();
        return {
          field: field.value,
          op: opTok.value as ConditionOp,
          values: [v.value],
          span: Parser.join(whenKw.span, v.span),
        };
      }
      this.diag('mapping/expected-condition-value', 'Expected a value after the comparison operator', v.span);
      this.recoverToStatement();
      return null;
    }

    this.diag(
      'mapping/expected-operator',
      "Expected 'in' or a comparison operator (==, !=, >, <, >=, <=) in condition",
      opTok.span,
    );
    this.recoverToStatement();
    return null;
  }

  private parsePath(): QualifiedPath | null {
    if (this.peek().type !== 'ident') return null;
    const first = this.next();
    const segments = [first.value];
    let endSpan = first.span;
    // A path is dotted identifiers. The lexer emits `.` inside an identifier only
    // when adjacent to word chars; between segments we scan for a literal dot.
    while (this.peekDot()) {
      this.consumeDot();
      if (this.peek().type === 'ident') {
        const seg = this.next();
        segments.push(seg.value);
        endSpan = seg.span;
      } else {
        this.diag('mapping/expected-path-segment', "Expected an identifier after '.'", this.peek().span);
        break;
      }
    }
    return {
      segments,
      text: segments.join('.'),
      span: Parser.join(first.span, endSpan),
    };
  }

  private parseCurie(): Curie | null {
    if (this.peek().type !== 'ident') return null;
    const prefix = this.next();
    if (this.peek().type !== 'colon') {
      // Not a CURIE; treat as an error at call site.
      this.pos--; // put it back
      return null;
    }
    this.next(); // ':'
    if (this.peek().type !== 'ident') {
      this.diag('mapping/expected-curie-local', "Expected a local name after ':' in the CURIE", this.peek().span);
      return null;
    }
    const local = this.next();
    return {
      prefix: prefix.value,
      local: local.value,
      text: `${prefix.value}:${local.value}`,
      span: Parser.join(prefix.span, local.span),
    };
  }

  // Paths are dotted identifiers; the lexer emits a `dot` token between segments.
  private peekDot(): boolean {
    return this.peek().type === 'dot';
  }

  private consumeDot(): void {
    this.next();
  }

  private expectIdent(code: string, message: string): Token | null {
    if (this.peek().type === 'ident') return this.next();
    this.diag(code, message, this.peek().span);
    return null;
  }

  /** Skip tokens until the next statement keyword or the end of the block. */
  private recoverToStatement(): void {
    while (!this.atEnd()) {
      const t = this.peek().type;
      if (t === 'rbrace' || STATEMENT_KEYWORDS.includes(t) || t === 'map') return;
      this.next();
    }
  }

  /** Skip to the closing brace (or a new `map`) after a broken block header. */
  private recoverToBlockEnd(): void {
    while (!this.atEnd()) {
      const t = this.peek().type;
      if (t === 'map') return;
      if (t === 'rbrace') {
        this.next();
        return;
      }
      this.next();
    }
  }
}

export function parse(src: string): ParseResult {
  const tokens = tokenize(src);
  const parser = new Parser(tokens);
  const mappings = parser.parseDocument();
  return { mappings, diagnostics: parser.diagnostics };
}
