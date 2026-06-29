/**
 * proof-pack.ts — BME §3.6 / Appendix A: every high-risk artifact carries a signed, hash-referenced proof pack.
 * Append-only inside the system; MAY be externally anchored. Redacted commitments are acceptable where raw
 * content cannot be retained.
 */
import type { DPBudget } from "./governance.js";

export interface ProofPackChecks {
  iri: number;
  gci?: number;
  tci?: number;
  dpBudgetRemaining: DPBudget;
}

export interface ProofWitness {
  type: "consent" | "adjudication" | "validator";
  hash: string;
  sig: string;
}

export interface ProofPack {
  artifact: "proof-pack";
  id: string;
  subject: string;
  policyFingerprint: string; // sha256-...
  source: { repo: string; commit: string; path: string };
  checks: ProofPackChecks;
  witnesses: ProofWitness[];
  signatures: string[]; // did:key:...
  merkleRoot: string; // sha256-...
}

export interface ProofPackValidation {
  ok: boolean;
  problems: string[];
}

/** Structural validation used by the CI proof-pack gate (§5, §22): a high-risk pack MUST be signed + hashed. */
export function validateProofPack(p: ProofPack): ProofPackValidation {
  const problems: string[] = [];
  if (p.artifact !== "proof-pack") problems.push("artifact must be 'proof-pack'");
  if (!p.id) problems.push("missing id");
  if (!/^sha256-/.test(p.policyFingerprint)) problems.push("policyFingerprint must be sha256-prefixed");
  if (!/^sha256-/.test(p.merkleRoot)) problems.push("merkleRoot must be sha256-prefixed");
  if (!p.signatures.length || p.signatures.some((s) => !s)) problems.push("at least one non-empty signature required");
  if (p.checks.dpBudgetRemaining.epsilon < 0 || (p.checks.dpBudgetRemaining.delta ?? 0) < 0) problems.push("DP budget remaining is negative (fail-closed violation)");
  return { ok: problems.length === 0, problems };
}
