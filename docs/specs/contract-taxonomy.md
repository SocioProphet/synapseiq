# Contract Taxonomy

This document defines the contract taxonomy for **SynapseIQ**.

A **schema** is not the same thing as a **contract**.
A **payload** is not the same thing as an **envelope**.
A **vendor mapping** is not the same thing as a **canonical model**.

SynapseIQ uses the following contract families.

## 1. Envelope contracts
These define the outer, transport-independent record wrapper.

Primary spec:
- `canonical-envelope.md`

## 2. Adapter contracts
These define the plugin boundary between source-native systems and SynapseIQ.

Primary spec:
- `adapter-sdk.md`

## 3. Stream contracts
These define event transport semantics across Kafka, Pub/Sub, and similar systems.

Primary spec:
- `stream-contract.md`

## 4. Warehouse contracts
These define raw, staging, canonical, and mart materialization behavior.

Primary spec:
- `warehouse-contract.md`

## 5. Provenance and confidence contracts
These define how evidence, confidence, review, and merge semantics are represented.

Primary spec:
- `provenance-confidence.md`

## 6. Policy and governance contracts
These define consent, classification, retention, redaction, activation policy, and access posture.

Primary spec:
- `policy-governance.md`

## 7. Developer tooling contracts
These define grammars, DSLs, language-server behavior, and future formal-method integration posture.

Primary spec:
- `grammar-lsp.md`

## 8. Canonical semantic model contracts
These define the UDM-aligned semantic center and ontology alignment posture.

Primary specs:
- `canonical-model.md`
- `capability-surface.md`

## Reading order

For new contributors, the recommended read order is:
1. `../adr/0001-product-scope.md`
2. `repository-architecture.md`
3. `capability-surface.md`
4. `canonical-model.md`
5. `canonical-envelope.md`
6. `adapter-sdk.md`
7. `stream-contract.md`
8. `warehouse-contract.md`
9. `provenance-confidence.md`
10. `policy-governance.md`
11. `grammar-lsp.md`

## Intent

This taxonomy exists to stop category confusion early. It is easier to build a coherent platform when everyone can distinguish the platform’s contract families from the beginning.