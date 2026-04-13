import type { RecordKind, RecordStage } from "./envelope";

export interface StreamAddress {
  transport: "kafka" | "pubsub" | "http" | "batch";
  topic_or_subscription: string;
  partition_key?: string;
}

export interface StreamRecordHeader {
  record_id: string;
  record_kind: RecordKind;
  record_stage: RecordStage;
  source_id: string;
  trace_id?: string;
  correlation_id?: string;
  event_ts: string;
}

export interface StreamDeliveryContract {
  ordering_scope: "partition" | "none";
  replayable: boolean;
  idempotent: boolean;
  dead_letter_supported: boolean;
}

export interface StreamEmission<TPayload = Record<string, unknown>> {
  header: StreamRecordHeader;
  payload: TPayload;
  address?: StreamAddress;
}
