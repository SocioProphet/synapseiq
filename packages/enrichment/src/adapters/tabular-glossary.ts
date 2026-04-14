import { BaseAdapter } from "../base-adapter";
import type {
  AdapterContext,
  AdapterDescriptor,
  CanonicalEnvelope,
  SourceRecord,
  ValidationResult,
} from "@socioprophet/synapseiq-contracts";
import { generateRecordId, isoNow } from "@socioprophet/synapseiq-utils";

export class TabularGlossaryAdapter extends BaseAdapter {
  describe(): AdapterDescriptor {
    return {
      adapter_id: "tabular-glossary-mapping",
      display_name: "Tabular Glossary Mapping Adapter",
      vendor: "generic",
      version: "0.1.0",
      supported_source_types: ["sync_api", "batch", "file"],
      supported_record_kinds: ["mapping"],
      supported_delivery_modes: ["sync_api", "batch", "stream"],
      privacy_posture: "metadata-only-by-default",
      capabilities: ["supports_glossary_mapping", "supports_explanations"],
    };
  }

  validate_source(input: unknown): ValidationResult {
    if (!input || typeof input !== "object") {
      return { ok: false, errors: ["Tabular glossary input must be an object"] };
    }

    const doc = input as Record<string, unknown>;
    if (!doc.table_name || !doc.column_name) {
      return { ok: false, errors: ["Missing table_name or column_name"] };
    }

    return { ok: true };
  }

  async ingest(input: unknown, _ctx: AdapterContext): Promise<SourceRecord[]> {
    return [
      {
        source_id: "tabular-glossary",
        payload: input,
        received_at: isoNow(),
      },
    ];
  }

  async normalize(record: SourceRecord, _ctx: AdapterContext): Promise<CanonicalEnvelope[]> {
    const payload = record.payload as Record<string, unknown>;

    return [
      {
        envelope_version: "1.0.0",
        record_kind: "mapping",
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
          processor: "tabular-glossary-adapter",
          method: "rule",
        },
        confidence: {
          overall: 0.5,
        },
        canonical: {
          mapping_type: "column_to_glossary",
          target: Array.isArray(payload.glossary_candidates) && payload.glossary_candidates.length > 0
            ? String(payload.glossary_candidates[0])
            : "unmapped",
          source_fields: [String(payload.table_name), String(payload.column_name)],
        },
        source_native: payload,
      },
    ];
  }
}
