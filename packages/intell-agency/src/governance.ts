/**
 * governance.ts — the BME-TS-SPEC-0001 governance primitives (§3.1–3.3, §6.2–6.3).
 *
 * These are the load-bearing types the rest of the boundary-of-meaning design depends on: a consent-hole is a
 * TYPED ABSENCE the system may ask to fill but MUST NOT silently infer; the DP budget is a linear resource that
 * fails CLOSED on exhaustion; the policy label is a product lattice whose dominance decides access. Pure +
 * dependency-free so the audit harness, CI gates, suppression engine, and policy-aware LSP all build on one core.
 */

export type PurposeId = `purpose_${string}`;
export type PolicyId = `policy_${string}`;

// ── §3.2 Differential-privacy budget monoid (linear resource, fail-closed) ──────
export interface DPBudget {
  epsilon: number;
  delta?: number;
  windowDays: number;
}

/** B0 = (0,0); + is componentwise; − fails CLOSED (throws) when it would go negative. */
export const Budget = {
  zero: (): DPBudget => ({ epsilon: 0, delta: 0, windowDays: 0 }),
  plus: (x: DPBudget, y: DPBudget): DPBudget => ({
    epsilon: x.epsilon + y.epsilon,
    delta: (x.delta ?? 0) + (y.delta ?? 0),
    windowDays: Math.max(x.windowDays, y.windowDays),
  }),
  minus: (x: DPBudget, dEps: number, dDel = 0): DPBudget => {
    const epsilon = x.epsilon - dEps;
    const delta = (x.delta ?? 0) - dDel;
    if (epsilon < 0 || delta < 0) throw new Error("DP budget exhausted"); // MUST fail closed (§3.2)
    return { epsilon, delta, windowDays: x.windowDays };
  },
  /** Non-throwing probe: would this spend leave the budget solvent? */
  solventAfter: (x: DPBudget, dEps: number, dDel = 0): boolean =>
    x.epsilon - dEps >= 0 && (x.delta ?? 0) - dDel >= 0,
};

// ── §3.1 / §6.2 Consent-hole: a typed absence that MUST be filled by a witness ──
export interface ConsentHole<T> {
  goal: "user_supplied";
  purpose: PurposeId;
  retentionDays: number;
  dp: DPBudget;
  /** phantom marker so the carried type T is preserved through the type system */
  readonly _t?: (x: T) => T;
}

export interface ConsentWitness<T> {
  purpose: PurposeId; // MUST match the hole's purpose
  value: T;
  signature: string; // non-empty signed authorization
  retentionDays?: number;
}

export function consentHole<T>(purpose: PurposeId, retentionDays: number, dp: DPBudget): ConsentHole<T> {
  return { goal: "user_supplied", purpose, retentionDays, dp };
}

/**
 * Fill a consent-hole — ONLY from a witness whose purpose matches and whose signature is present (§6.2: filling
 * MUST verify policy/purpose/retention/signature; AUTO-FILL MUST FAIL). There is deliberately no overload that
 * produces a value without a witness — the system may ask, it may not guess.
 */
export function fillConsentHole<T>(hole: ConsentHole<T>, witness: ConsentWitness<T>): T {
  if (witness.purpose !== hole.purpose) throw new Error(`consent purpose mismatch: hole=${hole.purpose} witness=${witness.purpose}`);
  if (!witness.signature || witness.signature.trim() === "") throw new Error("consent-hole fill requires a non-empty signature (auto-fill forbidden)");
  if (witness.retentionDays !== undefined && witness.retentionDays > hole.retentionDays) {
    throw new Error(`witness retention ${witness.retentionDays}d exceeds hole bound ${hole.retentionDays}d`);
  }
  return witness.value;
}

// ── §3.3 / §18 Label lattice: L = Clearance × Purpose × Retention × DP × Sensitivity × Jurisdiction ──
export type Sensitivity = "low" | "high" | "critical";
const SENS_RANK: Record<Sensitivity, number> = { low: 0, high: 1, critical: 2 };

export interface PolicyLabel {
  clearance: number; // higher dominates
  purpose: PurposeId;
  retentionDays: number;
  dp: DPBudget;
  sensitivity: Sensitivity;
  jurisdiction?: string;
}

/**
 * Lattice dominance: a subject with label `subject` may access a resource labelled `resource` iff it dominates on
 * every governance dimension — clearance ≥, same purpose (purpose-binding), retention envelope ≥, sensitivity
 * clearance ≥, jurisdiction matches when the resource pins one, and the subject's DP budget can cover the resource.
 */
export function dominates(subject: PolicyLabel, resource: PolicyLabel): boolean {
  if (subject.clearance < resource.clearance) return false;
  if (subject.purpose !== resource.purpose) return false; // purpose-binding (§18)
  if (subject.retentionDays < resource.retentionDays) return false;
  if (SENS_RANK[subject.sensitivity] < SENS_RANK[resource.sensitivity]) return false;
  if (resource.jurisdiction && subject.jurisdiction !== resource.jurisdiction) return false;
  return Budget.solventAfter(subject.dp, resource.dp.epsilon, resource.dp.delta ?? 0);
}

// ── §3.3 Obligations: temporal predicates over labels that produce witnesses ────
export interface Obligation {
  kind: "retention" | "deletion" | "audit" | "adjudication" | "recheck";
  dueBy: string; // ISO timestamp
  label: PolicyLabel;
}

export interface ObligationWitness {
  obligationKind: Obligation["kind"];
  satisfiedAt: string;
  artifactHash: string;
}

/** Satisfy an obligation by timer + artifact → a witness (ObligationSatisfied(label, timer, artifact) → Witness). */
export function satisfyObligation(o: Obligation, nowIso: string, artifactHash: string): ObligationWitness {
  if (!artifactHash) throw new Error("obligation satisfaction requires an artifact hash");
  return { obligationKind: o.kind, satisfiedAt: nowIso, artifactHash };
}
