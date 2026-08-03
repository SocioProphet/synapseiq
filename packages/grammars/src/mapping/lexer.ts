// SynapseIQ Mapping DSL — lexer.
//
// Error-tolerant tokenizer. It never throws: unexpected characters become
// `error` tokens so the parser can recover and still lower the rest of the
// document (the spec requires "error-tolerant parsing during editing").

import type { Span } from './ir.js';

export type TokenType =
  | 'map'
  | 'source'
  | 'transform'
  | 'using'
  | 'link'
  | 'to'
  | 'when'
  | 'in'
  | 'ident'
  | 'string'
  | 'number'
  | 'arrow' // ->
  | 'lbrace' // {
  | 'rbrace' // }
  | 'lbracket' // [
  | 'rbracket' // ]
  | 'comma' // ,
  | 'colon' // :
  | 'dot' // .
  | 'op' // == != > < >= <=
  | 'eof'
  | 'error';

export interface Token {
  type: TokenType;
  /** Raw text. For `string` tokens this is the unquoted value. */
  value: string;
  span: Span;
}

const KEYWORDS: Record<string, TokenType> = {
  map: 'map',
  source: 'source',
  transform: 'transform',
  using: 'using',
  link: 'link',
  to: 'to',
  when: 'when',
  in: 'in',
};

// Identifier: letter/underscore start, then letters/digits/underscore/hyphen.
// Hyphens are allowed so vendor segments like `identity-firmographic` tokenize
// as a single identifier.
const IDENT_START = /[A-Za-z_]/;
const IDENT_CONT = /[A-Za-z0-9_-]/;

export function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 0;
  let col = 0;

  const makeSpan = (offset: number, length: number, sLine: number, sCol: number): Span => ({
    line: sLine,
    col: sCol,
    endLine: line,
    endCol: col,
    offset,
    length,
  });

  const advance = (n = 1): void => {
    for (let k = 0; k < n; k++) {
      if (src[i] === '\n') {
        line++;
        col = 0;
      } else {
        col++;
      }
      i++;
    }
  };

  while (i < src.length) {
    const ch = src[i]!;

    // Whitespace
    if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n') {
      advance();
      continue;
    }

    // Comments: `#` to end of line, and `//` to end of line.
    if (ch === '#' || (ch === '/' && src[i + 1] === '/')) {
      while (i < src.length && src[i] !== '\n') advance();
      continue;
    }

    const startOffset = i;
    const startLine = line;
    const startCol = col;

    // Arrow ->
    if (ch === '-' && src[i + 1] === '>') {
      advance(2);
      tokens.push({ type: 'arrow', value: '->', span: makeSpan(startOffset, 2, startLine, startCol) });
      continue;
    }

    // Single-character punctuation
    const single: Record<string, TokenType> = {
      '{': 'lbrace',
      '}': 'rbrace',
      '[': 'lbracket',
      ']': 'rbracket',
      ',': 'comma',
      ':': 'colon',
      '.': 'dot',
    };
    if (single[ch]) {
      advance();
      tokens.push({ type: single[ch]!, value: ch, span: makeSpan(startOffset, 1, startLine, startCol) });
      continue;
    }

    // Comparison operators: == != >= <= > <
    if (ch === '=' || ch === '!' || ch === '>' || ch === '<') {
      let op = ch;
      if (src[i + 1] === '=') op += '=';
      // `=` alone is not a valid operator in this DSL.
      if (op === '=') {
        advance();
        tokens.push({ type: 'error', value: '=', span: makeSpan(startOffset, 1, startLine, startCol) });
        continue;
      }
      advance(op.length);
      tokens.push({ type: 'op', value: op, span: makeSpan(startOffset, op.length, startLine, startCol) });
      continue;
    }

    // String literal (double-quoted, with \" and \\ escapes)
    if (ch === '"') {
      advance(); // opening quote
      let value = '';
      let terminated = false;
      while (i < src.length) {
        const c = src[i]!;
        if (c === '\\' && i + 1 < src.length) {
          const next = src[i + 1]!;
          value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
          advance(2);
          continue;
        }
        if (c === '"') {
          advance();
          terminated = true;
          break;
        }
        if (c === '\n') break; // unterminated on this line
        value += c;
        advance();
      }
      tokens.push({
        type: terminated ? 'string' : 'error',
        value: terminated ? value : `unterminated string: "${value}`,
        span: makeSpan(startOffset, i - startOffset, startLine, startCol),
      });
      continue;
    }

    // Number literal
    if (/[0-9]/.test(ch)) {
      while (i < src.length && /[0-9.]/.test(src[i]!)) advance();
      tokens.push({
        type: 'number',
        value: src.slice(startOffset, i),
        span: makeSpan(startOffset, i - startOffset, startLine, startCol),
      });
      continue;
    }

    // Identifier / keyword
    if (IDENT_START.test(ch)) {
      while (i < src.length && IDENT_CONT.test(src[i]!)) advance();
      const raw = src.slice(startOffset, i);
      const kw = KEYWORDS[raw];
      tokens.push({
        type: kw ?? 'ident',
        value: raw,
        span: makeSpan(startOffset, i - startOffset, startLine, startCol),
      });
      continue;
    }

    // Anything else: error token, consume one char and keep going.
    advance();
    tokens.push({ type: 'error', value: ch, span: makeSpan(startOffset, 1, startLine, startCol) });
  }

  tokens.push({
    type: 'eof',
    value: '',
    span: { line, col, endLine: line, endCol: col, offset: i, length: 0 },
  });
  return tokens;
}
