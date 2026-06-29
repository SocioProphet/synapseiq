# @socioprophet/synapseiq-intell-agency

The governance core for **BME-TS-SPEC-0001 — "At the Boundary of Meaning, Intelligence & Emergence."**
This package is the spec's *Phase 1 / Deliverable 1*: the typed channels through which intelligence is allowed
to act. Everything downstream in the spec — the audit harness (GCI/TCI/IRI), the CI gates, the suppression
engine, and the policy-aware LSP — builds on these primitives.

## What's implemented (this slice)

| Primitive | Spec § | Module |
|-----------|--------|--------|
| `ConsentHole<T>` — a typed absence; **auto-fill forbidden**, fill only from a signed, purpose-matched, retention-bounded witness | §3.1, §6.2 | `src/governance.ts` |
| DP budget monoid (`Budget.zero/plus/minus`) — a linear resource that **fails closed** on exhaustion | §3.2 | `src/governance.ts` |
| Policy label lattice + `dominates()` — access by dominance on clearance × purpose × retention × DP × sensitivity × jurisdiction | §3.3, §18 | `src/governance.ts` |
| Obligations → witnesses | §3.3 | `src/governance.ts` |
| `Canonical<T>` / `Approx<T>` + `EqualityGate` — identity as a **proven quotient**; no silent merge, quorum-gated, before/after + rollback recorded | §3.4, §6, §19 | `src/equality.ts` |
| Numeric tolerance + boundary-flip stability guard | §3.5 | `src/numeric.ts` |
| Identity Risk Index (`computeIri`) + fit classifier (surjection/injection/bijection) | §1, §7.3, §13 | `src/iri.ts` |
| Proof-pack type + structural validation (signed, sha256, non-negative budget) | §3.6, App. A | `src/proof-pack.ts` |

## Not yet in this slice (sequenced follow-ups)

GCI/TCI scorers, the full audit-harness CLI, Tree-sitter grammars + external scanners (indent/dedent,
heredoc/percent-string), the four DSL compilers, the policy-aware LSP diagnostics, CEGAR/SMT numeric verification,
and the CI gates that consume these primitives. See the BME spec §§5–23.

## Run

```bash
pnpm --filter @socioprophet/synapseiq-intell-agency test       # node:test via tsx — 11/11
pnpm --filter @socioprophet/synapseiq-intell-agency typecheck  # requires workspace typescript installed
```
