# @socioprophet/synapseiq-grammars

Versioned Tree-sitter grammars and lowering for the SynapseIQ DSLs, per
[`docs/specs/grammar-lsp.md`](../../docs/specs/grammar-lsp.md). Grammars are a
first-class product surface: they must be versioned and tested.

## DSL surface (from the spec)

| DSL                     | Grammar source-of-truth                    | Reference lowering → durable IR | Status |
| ----------------------- | ------------------------------------------ | ------------------------------- | ------ |
| Mapping DSL             | `tree-sitter-synapseiq-mapping/grammar.js` | `src/mapping/`                  | ✅ landed (T7-18) |
| Enrichment Rule DSL     | —                                          | —                               | planned |
| Semantic Query DSL      | —                                          | —                               | planned |
| Contract Authoring DSL  | —                                          | —                               | planned |

## Mapping DSL (T7-18)

The Mapping DSL declares how vendor-native fields map to canonical fields
(`source … -> …`), field transformations (`transform … using …`), and ontology
links (`link … to <curie> when <condition>`). Example:

```text
map vendor.identity-firmographic.identity_touch {
  source company_name -> canonical.entity.organization.display_name
  transform company_domain using normalize_domain
  link canonical.entity.organization to fibo:Corporation when industry in ["banking", "finance"]
}
```

### What "lowering" means here

Source text is lowered into a durable, serializable **internal representation**
(`MappingDocument` in `src/mapping/ir.ts`) that downstream tooling (LSP
diagnostics, transformation planner, contract validator) consumes without
re-parsing. The lowering is:

- **error-tolerant** — a broken statement or block records a diagnostic and
  recovers; it never blanks out the rest of the document;
- **content-addressed** — every document carries a FIPS SHA-256 `irHash` over
  its lowered structure (spans excluded), so the same semantic mapping always
  has the same identity regardless of formatting or comments.

`tree-sitter-synapseiq-mapping/grammar.js` is the canonical grammar
(spec-as-code). The hand-written recursive-descent lowering in `src/mapping/`
parses the same language node-for-node and is the reference until the native
tree-sitter parser is generated from the grammar (tracked as a follow-up).

## Usage

```ts
import { lowerMapping, isValidMapping } from '@socioprophet/synapseiq-grammars';

const doc = lowerMapping(sourceText);
if (!isValidMapping(doc)) console.error(doc.diagnostics);
```

CLI validation mode (spec: "CLI validation mode for CI/CD") — exits non-zero on
any error-severity diagnostic:

```sh
synapseiq-mapping-lint path/to/file.sqmap
```

## Tests

```sh
pnpm --filter @socioprophet/synapseiq-grammars test
```

Golden lowering tests (`test/mapping.lower.test.ts`) and malformed-input
diagnostic tests (`test/mapping.diagnostics.test.ts`) run in CI via
`.github/workflows/grammars.yml`.
