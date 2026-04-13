# ADR 0001: Product Scope

## Status
Accepted

## Context

We are building **SynapseIQ** as a reusable semantic enrichment and intelligence substrate.

The initial temptation was to shape this system around a single vendor integration. That would have produced a narrow connector with low reuse and high redesign cost as new sources arrived.

We instead need a product platform that can:
- absorb multiple vendors and source types
- normalize them into a canonical model
- enrich them semantically using glossary and ontology layers
- preserve provenance and explainability
- serve downstream analytics, martech, security, and operational workflows

## Decision

SynapseIQ will be treated as a **product platform** rather than a single-vendor tool.

The product scope includes:
- canonical contracts and envelopes
- vendor adapter SDK and adapter implementations
- semantic normalization and enrichment layer
- ontology and UDM alignment layer
- reasoning and explanation layer
- warehouse materialization contracts
- developer tooling surfaces such as grammars and LSP integration
- operational controls for governance, privacy, and observability

The product scope explicitly excludes, for the initial tranche:
- a full end-user web UI
- every vendor integration at launch
- premature deep model specialization before contracts stabilize

## Consequences

### Positive
- the repository shape supports long-term extensibility
- vendor integrations become modular rather than invasive
- semantic quality and governance remain first-class
- downstream systems can consume stable canonical outputs
- the platform can support multiple verticals without redesign

### Negative
- initial design work is heavier than a point integration
- some early implementation velocity is traded for architectural durability
- more emphasis is required on contracts, testing, and governance early on

## Rationale

This choice is justified because:
- we already know the system must serve more than one vendor
- we want a world-class capability surface, not a brittle connector
- ontology alignment, reasoning, and activation are shared capabilities that should not be duplicated per source

## Follow-on decisions

Subsequent ADRs should define:
1. canonical record envelopes
2. warehouse dataset contracts
3. adapter SDK interfaces
4. ontology alignment strategy
5. grammar/LSP scope
6. formal methods integration posture
