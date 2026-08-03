/**
 * Tree-sitter grammar for the SynapseIQ Mapping DSL.
 *
 * This is the versioned, canonical grammar source-of-truth for the mapping
 * language defined in docs/specs/grammar-lsp.md (§1 Mapping DSL). It is the
 * spec-as-code: the hand-written reference lowering in
 * `packages/grammars/src/mapping/` parses the SAME language node-for-node and
 * emits the durable IR. When the native tree-sitter parser is generated
 * (`tree-sitter generate`, tracked as a follow-up), it must agree with the
 * reference lowering on the corpus in `test/fixtures/`.
 *
 * Grammar version is recorded in ./grammar.json and mirrored by
 * MAPPING_GRAMMAR_VERSION in ../src/mapping/lower.ts.
 *
 * @see https://tree-sitter.github.io/tree-sitter/creating-parsers
 */
module.exports = grammar({
  name: 'synapseiq_mapping',

  extras: ($) => [/\s/, $.comment],

  rules: {
    document: ($) => repeat($.mapping_block),

    mapping_block: ($) =>
      seq('map', field('target', $.path), '{', repeat($.statement), '}'),

    statement: ($) =>
      choice($.source_statement, $.transform_statement, $.link_statement),

    // source <field> -> <canonical.path>
    source_statement: ($) =>
      seq('source', field('source_field', $.identifier), '->', field('target', $.path)),

    // transform <field> using <function>
    transform_statement: ($) =>
      seq('transform', field('field', $.identifier), 'using', field('using', $.identifier)),

    // link <path> to <curie> [when <condition>]
    link_statement: ($) =>
      seq('link', field('from', $.path), 'to', field('to', $.curie), optional($.when_clause)),

    when_clause: ($) => seq('when', field('condition', $.condition)),

    condition: ($) =>
      choice(
        seq(field('field', $.identifier), 'in', $.value_list),
        seq(field('field', $.identifier), field('op', $.comparison_operator), field('value', $._value)),
      ),

    value_list: ($) => seq('[', optional(seq($._value, repeat(seq(',', $._value)))), ']'),

    comparison_operator: () => choice('==', '!=', '>=', '<=', '>', '<'),

    _value: ($) => choice($.string, $.number, $.identifier),

    path: ($) => seq($.identifier, repeat(seq('.', $.identifier))),

    curie: ($) => seq(field('prefix', $.identifier), ':', field('local', $.identifier)),

    // Identifiers allow hyphens so vendor segments like `identity-firmographic`
    // are a single token.
    identifier: () => /[A-Za-z_][A-Za-z0-9_-]*/,

    string: () => /"([^"\\]|\\.)*"/,

    number: () => /[0-9]+(\.[0-9]+)?/,

    comment: () => token(choice(seq('#', /.*/), seq('//', /.*/))),
  },
});
