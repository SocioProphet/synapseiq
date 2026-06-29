/**
 * @socioprophet/synapseiq-intell-agency — the BME-TS-SPEC-0001 governance core (Phase 1 / Deliverable 1).
 *
 * The typed channels through which intelligence is allowed to act: consent-holes (typed absences), a DP budget
 * monoid that fails closed, a policy label lattice, witnessed equality (identity as a proven quotient), numeric
 * tolerance guards, the Identity Risk Index + fit classifier, and the signed proof-pack. Everything downstream —
 * the audit harness, the CI gates, the suppression engine, the policy-aware LSP — builds on these.
 */
export * from "./governance.js";
export * from "./equality.js";
export * from "./numeric.js";
export * from "./iri.js";
export * from "./gci.js";
export * from "./tci.js";
export * from "./audit-harness.js";
export * from "./proof-pack.js";
