import type {
  AdapterContext,
  AdapterDescriptor,
  CanonicalEnvelope,
  EmitResult,
  Explanation,
  SourceRecord,
  SynapseIQAdapter,
  ValidationResult,
} from "@socioprophet/synapseiq-contracts";

export abstract class BaseAdapter implements SynapseIQAdapter {
  abstract describe(): AdapterDescriptor;
  abstract validate_source(input: unknown): ValidationResult;
  abstract ingest(input: unknown, ctx: AdapterContext): Promise<SourceRecord[]>;
  abstract normalize(record: SourceRecord, ctx: AdapterContext): Promise<CanonicalEnvelope[]>;

  async enrich(record: CanonicalEnvelope, _ctx: AdapterContext): Promise<CanonicalEnvelope[]> {
    return [record];
  }

  validate_output(_record: CanonicalEnvelope, _ctx: AdapterContext): ValidationResult {
    return { ok: true };
  }

  async emit(record: CanonicalEnvelope, _ctx: AdapterContext): Promise<EmitResult> {
    return {
      emitted: true,
      record_id: record.record_id,
    };
  }

  async explain(_record: CanonicalEnvelope, _ctx: AdapterContext): Promise<Explanation[]> {
    return [];
  }
}
