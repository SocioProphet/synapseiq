import type { CanonicalEnvelope } from "./envelope";

export interface ValidationResult {
  ok: boolean;
  errors?: string[];
  warnings?: string[];
}

export interface AdapterDescriptor {
  adapter_id: string;
  display_name: string;
  vendor: string;
  version: string;
  supported_source_types: string[];
  supported_record_kinds: string[];
  supported_delivery_modes: Array<"stream" | "batch" | "sync_api">;
  privacy_posture: string;
  capabilities: string[];
}

export interface AdapterContext {
  trace_id: string;
  correlation_id?: string;
  environment: "dev" | "staging" | "prod";
  policy_version?: string;
  feature_flags?: Record<string, boolean>;
  logger?: unknown;
  metrics?: unknown;
}

export interface SourceRecord {
  source_id: string;
  payload: unknown;
  received_at: string;
}

export interface EmitResult {
  emitted: boolean;
  destination?: string;
  record_id?: string;
}

export interface Explanation {
  explanation_id?: string;
  kind?: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface SynapseIQAdapter {
  describe(): AdapterDescriptor;
  validate_source(input: unknown): ValidationResult;
  ingest(input: unknown, ctx: AdapterContext): Promise<SourceRecord[]>;
  normalize(record: SourceRecord, ctx: AdapterContext): Promise<CanonicalEnvelope[]>;
  enrich(record: CanonicalEnvelope, ctx: AdapterContext): Promise<CanonicalEnvelope[]>;
  validate_output(record: CanonicalEnvelope, ctx: AdapterContext): ValidationResult;
  emit(record: CanonicalEnvelope, ctx: AdapterContext): Promise<EmitResult>;
  explain(record: CanonicalEnvelope, ctx: AdapterContext): Promise<Explanation[]>;
}
