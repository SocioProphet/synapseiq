import { BaseAdapter } from "../base-adapter";
import type {
  AdapterContext,
  AdapterDescriptor,
  CanonicalEnvelope,
  SourceRecord,
  ValidationResult,
} from "@socioprophet/synapseiq-contracts";
import { generateRecordId, isoNow } from "@socioprophet/synapseiq-utils";

interface ZoomInfoIdentityTouch {
  company_name?: string;
  company_domain?: string;
  person_name?: string;
  page_url?: string;
}

export class ZoomInfoAdapter extends BaseAdapter {
  describe(): AdapterDescriptor {
    return {
      adapter_id: "zoominfo-identity-touch",
      display_name: "ZoomInfo Identity Touch Adapter",
      vendor: "zoominfo",
      version: "0.1.0",
      supported_source_types: ["webhook", "sync_api"],
      supported_record_kinds: ["event", "entity", "link"],
      supported_delivery_modes: ["sync_api", "batch", "stream"],
      privacy_posture: "firmographic-and-page-signal",
      capabilities: [
        "supports_batch",
        "supports_stream",
        "supports_entity_extraction",
        "supports_explanations",
      ],
    };
  }

  validate_source(input: unknown): ValidationResult {
    if (!input || typeof input !== "object") {
      return { ok: false, errors: ["ZoomInfo input must be an object"] };
    }
    return { ok: true };
  }

  async ingest(input: unknown, _ctx: AdapterContext): Promise<SourceRecord[]> {
    return [
      {
        source_id: "zoominfo",
        payload: input,
        received_at: isoNow(),
      },
    ];
  }

  async normalize(record: SourceRecord, _ctx: AdapterContext): Promise<CanonicalEnvelope[]> {
    const payload = (record.payload ?? {}) as ZoomInfoIdentityTouch;
    const envelopes: CanonicalEnvelope[] = [];

    envelopes.push({
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
        processor: "zoominfo-adapter",
        method: "rule",
      },
      canonical: {
        event_type: "zoominfo_identity_touch",
        attributes: {
          page_url: payload.page_url ?? null,
        },
      },
      source_native: payload as unknown as Record<string, unknown>,
    });

    if (payload.company_name) {
      envelopes.push({
        envelope_version: "1.0.0",
        record_kind: "entity",
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
          processor: "zoominfo-adapter",
          method: "rule",
        },
        canonical: {
          entity_type: "organization",
          display_name: payload.company_name,
          normalized_name: payload.company_domain ?? payload.company_name,
          attributes: {
            company_domain: payload.company_domain ?? null,
          },
        },
        source_native: payload as unknown as Record<string, unknown>,
      });
    }

    if (payload.person_name) {
      envelopes.push({
        envelope_version: "1.0.0",
        record_kind: "entity",
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
          processor: "zoominfo-adapter",
          method: "rule",
        },
        canonical: {
          entity_type: "person",
          display_name: payload.person_name,
          normalized_name: payload.person_name,
        },
        source_native: payload as unknown as Record<string, unknown>,
      });
    }

    return envelopes;
  }
}
