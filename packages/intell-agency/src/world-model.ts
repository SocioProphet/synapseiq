/**
 * world-model.ts — BME §2.17 / §6.2: portable, policy-aware world-model + observation records.
 *
 * The typed carriers that cross the substrate boundary: an {@link Observation} is a provenance-bearing,
 * policy-referenced datum whose redaction MUST match its sensitivity; a {@link WorldModelRef} is a portable,
 * signed model artifact that MUST carry SBOM, license, policy fingerprint and training lineage before it can be
 * gossiped or reused. Both validate fail-closed. Pure + composable (no I/O).
 */
import type { PolicyId } from "./governance.js";

export type ObsId = `obs_${string}`;
export type WorldModelId = `wm_${string}`;
export type AgentId = `agent_${string}`;
export type SchemaUri = `schema://${string}`;

/** A resolvable, fingerprinted policy reference (BME branded-ID set). */
export interface PolicyRef {
  id: PolicyId;
  version: string;
  fingerprint: string; // sha256-...
}

export interface OntologyRef {
  id: string;
  version: string;
  checksum: string; // sha256-...
}

export interface EmbeddingIndexRef {
  uri: string;
  dimensionality: number;
  source: string;
  checksum: string; // sha256-...
}

export type Redaction = "none" | "pseudonymized" | "aggregated";

/** A typed, provenance-bearing observation (§6.2). */
export interface Observation<T> {
  id: ObsId;
  policyRef: PolicyRef;
  provenance: {
    source: string;
    acquiredAt: string; // ISO-8601
    schema: SchemaUri;
    checksum?: string;
  };
  redaction: Redaction;
  classification?: { labels: string[]; confidence?: number };
  payload: T;
}

/** A portable, signed, policy-aware world-model reference (§2.17). */
export interface WorldModelRef {
  id: WorldModelId;
  version: string;
  uri: string;
  checksum: string; // sha256-...
  ontology: OntologyRef;
  embeddings?: EmbeddingIndexRef;
  seedAtomsUri?: string;
  // A model artifact MUST carry these before it may be gossiped/reused (§6.2).
  sbomUri: string;
  license: string;
  policyFingerprint: string; // sha256-...
  trainingLineageUri: string;
  evaluationCommitments: string[];
}

export interface Validation {
  ok: boolean;
  problems: string[];
}

/** Labels that force a non-`none` redaction (raw sensitive data MUST NOT ride uncoarsened). */
const SENSITIVE_LABEL = /sensitive|health|biometric|precise_location|patient|sexuality|religion|ethnicity/i;

/** Validate an Observation fail-closed: branded id, resolvable policy ref, provenance, and — key privacy rule —
 * a sensitive classification MUST carry a pseudonymized/aggregated redaction (never raw). */
export function validateObservation<T>(o: Observation<T>): Validation {
  const problems: string[] = [];
  if (!/^obs_/.test(o.id)) problems.push("id must be obs_-prefixed");
  if (!o.policyRef?.id || !/^sha256-/.test(o.policyRef?.fingerprint ?? "")) {
    problems.push("policyRef requires id + sha256- fingerprint");
  }
  if (!o.provenance?.source) problems.push("provenance.source required");
  if (!/^schema:\/\//.test(o.provenance?.schema ?? "")) problems.push("provenance.schema must be a schema:// URI");
  const sensitive = o.classification?.labels?.some((l) => SENSITIVE_LABEL.test(l)) ?? false;
  if (sensitive && o.redaction === "none") {
    problems.push("sensitive classification requires pseudonymized/aggregated redaction (raw forbidden)");
  }
  return { ok: problems.length === 0, problems };
}

/** Validate a WorldModelRef fail-closed: it MUST be checksummed, policy-fingerprinted, and carry SBOM, license,
 * training lineage and evaluation commitments before it may be shared/reused. */
export function validateWorldModelRef(m: WorldModelRef): Validation {
  const problems: string[] = [];
  if (!/^wm_/.test(m.id)) problems.push("id must be wm_-prefixed");
  if (!m.checksum) problems.push("checksum required");
  if (!/^sha256-/.test(m.policyFingerprint ?? "")) problems.push("policyFingerprint must be sha256-prefixed");
  if (!m.sbomUri) problems.push("SBOM required");
  if (!m.license) problems.push("license required");
  if (!m.trainingLineageUri) problems.push("training lineage required");
  if (!m.evaluationCommitments?.length) problems.push("evaluation commitments required");
  if (m.embeddings && (!m.embeddings.checksum || !m.embeddings.dimensionality)) {
    problems.push("embedding index requires dimensionality + checksum");
  }
  return { ok: problems.length === 0, problems };
}
