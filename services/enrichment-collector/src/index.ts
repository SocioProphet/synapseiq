import type { CanonicalEnvelope, SourceRecord, SynapseIQAdapter, AdapterContext } from "../../../packages/contracts/src";

export interface CollectorDependencies {
  adapter: SynapseIQAdapter;
}

export async function collect(
  input: unknown,
  ctx: AdapterContext,
  deps: CollectorDependencies,
): Promise<CanonicalEnvelope[]> {
  const sourceValidation = deps.adapter.validate_source(input);
  if (!sourceValidation.ok) {
    throw new Error(`Invalid source input: ${sourceValidation.errors?.join(", ") ?? "unknown error"}`);
  }

  const sourceRecords: SourceRecord[] = await deps.adapter.ingest(input, ctx);
  const output: CanonicalEnvelope[] = [];

  for (const sourceRecord of sourceRecords) {
    const normalized = await deps.adapter.normalize(sourceRecord, ctx);
    for (const record of normalized) {
      const enriched = await deps.adapter.enrich(record, ctx);
      for (const candidate of enriched) {
        const outputValidation = deps.adapter.validate_output(candidate, ctx);
        if (!outputValidation.ok) {
          throw new Error(`Invalid output record: ${outputValidation.errors?.join(", ") ?? "unknown error"}`);
        }
        output.push(candidate);
      }
    }
  }

  return output;
}
