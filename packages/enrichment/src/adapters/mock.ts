import { BaseAdapter } from "../base-adapter";
import type {
  AdapterContext,
  AdapterDescriptor,
  CanonicalEnvelope,
  SourceRecord,
  ValidationResult,
} from "@socioprophet/synapseiq-contracts";
import { generateRecordId, isoNow } from "@socioprophet/synapseiq-utils";

export class MockAdapter extends BaseAdapter {
  describe(): AdapterDescriptor {
    return {
      adapter_id: "mock-adapter",
      display_name: "Mock Adapter",
      vendor: "internal",
      version: "0.1.0",
      supported_source_types: ["sync_api"],
      supported_record_kinds: ["event"],
      supported_delivery_modes: ["sync_api", "batch", "stream"],
      privacy_posture: "internal-test-only",
      capabilities: ["supports_batch", "supports_stream", "supports_explanations"],
    };
  }

  validate_source(input: unknown): ValidationResult {
    if (!input || typeof input !== "object") {
      return { ok: false, errors: ["Input must be an object"] };
    }

    return { ok: true };
  }

  async ingest(input: unknown, _ctx: AdapterContext): Promise<SourceRecord[]> {
    return [
      {
        source_id: "mock-source",
        payload: input,
        received_at: isoNow(),
      },
    ];
  }

  async normalize(record: SourceRecord, _ctx: AdapterContext): Promise<CanonicalEnvelope[]> {
    return [
      {
        envelope_version: "1.0.0",
        record_kind: "event",
        record_stage: "normalized",
        record_id: generateRecordId(),
        record_ts: isoNow(),
        source: {
          source_id: record.source_id,
          source_type: "sync_api",
        },
        provenance: {
          ingested_at: record.received_at,
          processed_at: isoNow(),
          processor: "mock-adapter",
          method: "rule",
        },
        canonical: {
          event_type: "mock_event",
          attributes: {
            payload: record.payload,
          },
        },
      },
    ];
  }
}
