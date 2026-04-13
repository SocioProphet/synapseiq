# Grammar and LSP Specification

This document defines the grammar and Language Server Protocol surface for **SynapseIQ**.

This is a first-class product surface, not a convenience feature.

The purpose of the grammar/LSP layer is to make SynapseIQ:
- developer-native
- machine-authorable
- semantically safe to edit
- explainable at authoring time

## Goals

1. Provide structured DSLs for mappings, enrichment rules, and semantic queries.
2. Use **tree-sitter grammars** for parsing and incremental syntax awareness.
3. Expose **LSP features** for editing, validation, completion, navigation, and diagnostics.
4. Make contracts and ontologies discoverable from the editor.
5. Prepare the system for future formal methods integration.

## Surface areas

SynapseIQ should define grammar/LSP support for four language families:

1. **Mapping DSL**
2. **Enrichment Rule DSL**
3. **Semantic Query DSL**
4. **Contract Authoring DSL**

## 1. Mapping DSL

Purpose:
- map vendor-native fields to canonical fields
- declare transformations
- declare confidence strategies
- declare ontology and glossary targets

Example shape:

```text
map vendor.zoominfo.identity_touch {
  source company_name -> canonical.entity.organization.display_name
  source person_name -> canonical.entity.person.display_name
  source url -> canonical.event.page_url
  transform company_domain using normalize_domain
  link canonical.entity.organization to fibo:Corporation when industry in ["banking", "finance"]
}
```

## 2. Enrichment Rule DSL

Purpose:
- declare semantic enrichment rules
- combine rule and model outputs
- assign confidence composition strategies
- declare explanation templates

Example shape:

```text
rule glossary_map_high_confidence {
  when similarity(header_expansion, glossary.label) > 0.92
  then emit mapping.glossary_match
  confidence = 0.95
  explanation = "High-similarity glossary mapping"
}
```

## 3. Semantic Query DSL

Purpose:
- provide a higher-level query surface for event/entity/link reasoning
- compile to SQL, SPARQL, or internal query plans

Example shape:

```text
find organizations
where linked_to events
and glossary_mapping = "Vendor Identifier"
and confidence > 0.8
explain true
```

## 4. Contract Authoring DSL

Purpose:
- define or constrain record shapes and interface contracts in a syntax tailored to SynapseIQ
- compile to JSON Schema, TypeScript types, and validation artifacts

Example shape:

```text
contract EventRecord {
  record_id: uuid
  source_id: string
  event_ts: timestamp
  canonical_payload: json
  confidence: object
}
```

## Tree-sitter requirements

Tree-sitter grammars should be authored for each DSL.

Required capabilities:
- incremental parsing
- syntax tree generation
- error-tolerant parsing during editing
- queryable syntax nodes for semantic tooling

Recommended grammar targets:
- `packages/grammars/tree-sitter-synapseiq-mapping/`
- `packages/grammars/tree-sitter-synapseiq-rules/`
- `packages/grammars/tree-sitter-synapseiq-query/`
- `packages/grammars/tree-synapseiq-contracts/`

## LSP features

The SynapseIQ language server should provide:

### Core editing features
- diagnostics
- hover documentation
- autocomplete
- go to definition
- find references
- rename symbols
- formatting

### Semantic features
- ontology-aware completions
- glossary-aware completions
- contract validation
- adapter capability validation
- confidence strategy validation
- policy compatibility warnings

### Explainability features
- inline explanation previews
- lineage previews where possible
- rule contribution traces

## Integration targets

The LSP should support:
- VS Code
- Neovim
- JetBrains via LSP bridge where practical
- CLI validation mode for CI/CD

## Formal methods posture

The grammar/LSP surface should preserve room for future formal reasoning integrations such as:
- Agda-backed contract proofs
- typed rule verification
- static detection of unsafe mappings
- proof-carrying transformations

This does not need to be implemented in the first tranche, but the grammar design should not block it.

## CI/CD expectations

Grammar and LSP changes should be validated by:
- parser golden tests
- malformed input diagnostics tests
- contract round-trip tests
- editor fixture tests

## Non-negotiable requirements

1. Grammars must be versioned.
2. LSP diagnostics must understand SynapseIQ contracts, not just syntax.
3. Ontology and glossary references must be navigable from editor tooling.
4. DSLs must compile to durable internal representations.

## Rationale

The grammar/LSP layer is how SynapseIQ becomes a programmable semantic platform rather than a fixed pipeline. It enables world-class developer ergonomics and creates a foundation for typed, explainable, and eventually formally verifiable semantic automation.