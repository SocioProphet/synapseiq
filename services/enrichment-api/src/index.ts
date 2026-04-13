import type { CanonicalEnvelope } from "@socioprophet/synapseiq-contracts";
import { normalizeEnvelope } from "@socioprophet/synapseiq-normalization";

export interface ApiIngestRequest<TCanonical = Record<string, unknown>> {
  envelope: CanonicalEnvelope<TCanonical>;
}

export interface ApiIngestResponse {
  accepted: boolean;
  record_id: string;
}

export async function ingest<TCanonical = Record<string, unknown>>(
  request: ApiIngestRequest<TCanonical>,
): Promise<ApiIngestResponse> {
  const normalized = normalizeEnvelope(request.envelope);
  return {
    accepted: true,
    record_id: normalized.record_id,
  };
}
