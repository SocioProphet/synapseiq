export type RecordKind =
  | "event"
  | "entity"
  | "link"
  | "mapping"
  | "finding"
  | "activation";

export type RecordStage =
  | "raw"
  | "normalized"
  | "enriched"
  | "validated"
  | "inferred"
  | "activated";

export type ProcessingMethod = "rule" | "model" | "hybrid" | "manual";

export interface SourceRef {
  source_id: string;
  source_type: string;
  source_record_id?: string | null;
  source_url?: string | null;
  source_version?: string | null;
}

export interface TransportMeta {
  transport_id?: string | null;
  topic?: string | null;
  partition?: number | null;
  offset?: number | null;
  trace_id?: string | null;
  correlation_id?: string | null;
}

export interface PolicyMeta {
  policy_version?: string | null;
  consent_mode?: string | null;
  classification?: string | null;
  redactions_applied?: string[];
  retention_class?: string | null;
}

export interface ProvenanceMeta {
  ingested_at: string;
  processed_at: string;
  processor: string;
  processor_version?: string | null;
  method: ProcessingMethod;
  inputs?: string[];
  run_id?: string | null;
  trace_id?: string | null;
}

export interface ConfidenceMeta {
  overall?: number | null;
  field_confidence?: Record<string, unknown> | null;
  explanation_ref?: string | null;
}

export interface CanonicalEnvelope<TCanonical = Record<string, unknown>> {
  envelope_version: "1.0.0";
  record_kind: RecordKind;
  record_stage: RecordStage;
  record_id: string;
  record_ts: string;
  source: SourceRef;
  transport?: TransportMeta | null;
  policy?: PolicyMeta | null;
  provenance: ProvenanceMeta;
  confidence?: ConfidenceMeta | null;
  canonical: TCanonical;
  source_native?: Record<string, unknown> | null;
  explanations?: Array<Record<string, unknown>>;
  errors?: Array<Record<string, unknown>>;
}
