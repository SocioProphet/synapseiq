/**
 * proof-pack-canonical.ts — map the intell-agency ProofPack onto the CANONICAL estate ProofPack
 * (prophet-core-contracts proof-pack.schema.json), the ledger-convergence shape (#35).
 *
 * The local pack already carries checks/witnesses/signatures/merkleRoot; this maps them onto the
 * canonical fields: merkleRoot → ledger.head (algo sha256), checks → checks[], witnesses → witnesses[],
 * policyFingerprint → provenance. The caller supplies the epistemic level (the local pack does not
 * carry one) — so a canonical pack without a graded standing is unrepresentable.
 */
import type { ProofPack } from "./proof-pack.js";

export type EpistemicLevel = "rejected" | "speculative" | "synthetic" | "empirical" | "bounded" | "proved";
export type ClaimMode =
  | "formal_construction" | "illustrative" | "fixture_validated"
  | "experimental" | "independently_reproduced" | "audited";

export interface CanonicalProofPack {
  schema_version: "0.1.0";
  proof_pack_id: string;
  subject_ref: { ref_type: string; ref_id: string; uri?: string };
  claim_mode: ClaimMode;
  epistemic_level: EpistemicLevel;
  ledger: { algo: "blake3" | "blake2b" | "sha256"; head: string; prior?: string };
  checks?: { name: string; value?: number; threshold?: number; passed: boolean }[];
  witnesses?: { type: "consent" | "adjudication" | "validator"; hash: string; sig: string }[];
  evidence_refs?: string[];
  signatures: string[];
  provenance?: Record<string, unknown>;
  created_at: string;
}

export interface ToCanonicalOptions {
  epistemicLevel: EpistemicLevel;
  createdAt: string;
  claimMode?: ClaimMode;
}

const stripHashPrefix = (h: string): string => h.replace(/^sha256-/, "");
const slugId = (id: string): string => "proofpack_" + id.toLowerCase().replace(/[^a-z0-9_.-]/g, "-");

/** Map an intell-agency ProofPack to the canonical estate ProofPack. */
export function toCanonicalProofPack(pack: ProofPack, opts: ToCanonicalOptions): CanonicalProofPack {
  if (!pack.signatures.length || pack.signatures.some((s) => !s)) {
    throw new Error("a canonical ProofPack requires >=1 non-empty signature");
  }
  const checks: CanonicalProofPack["checks"] = [
    { name: "iri", value: pack.checks.iri, passed: true },
  ];
  if (pack.checks.gci !== undefined) checks.push({ name: "gci", value: pack.checks.gci, passed: true });
  if (pack.checks.tci !== undefined) checks.push({ name: "tci", value: pack.checks.tci, passed: true });
  const dp = pack.checks.dpBudgetRemaining;
  checks.push({ name: "dp_budget_solvent", passed: dp.epsilon >= 0 && (dp.delta ?? 0) >= 0 });

  return {
    schema_version: "0.1.0",
    proof_pack_id: slugId(pack.id),
    subject_ref: { ref_type: "artifact", ref_id: pack.subject },
    claim_mode: opts.claimMode ?? "fixture_validated",
    epistemic_level: opts.epistemicLevel,
    ledger: { algo: "sha256", head: stripHashPrefix(pack.merkleRoot) },
    checks,
    witnesses: pack.witnesses.map((w) => ({ type: w.type, hash: stripHashPrefix(w.hash), sig: w.sig })),
    evidence_refs: [],
    signatures: [...pack.signatures],
    provenance: {
      producer: "synapseiq.intell-agency",
      policy_fingerprint: pack.policyFingerprint,
      source_ref: `${pack.source.repo}@${pack.source.commit}:${pack.source.path}`,
    },
    created_at: opts.createdAt,
  };
}
