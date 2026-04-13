import type { CanonicalEnvelope } from "@socioprophet/synapseiq-contracts";
import { enrichEnvelope } from "@socioprophet/synapseiq-enrichment";

export interface ReasoningRequest<TCanonical = Record<string, unknown>> {
  envelope: CanonicalEnvelope<TCanonical>;
}

export interface ReasoningResponse<TCanonical = Record<string, unknown>> {
  envelope: CanonicalEnvelope<TCanonical>;
  explanations: Array<Record<string, unknown>>;
}

export async function reason<TCanonical = Record<string, unknown>>(
  request: ReasoningRequest<TCanonical>,
): Promise<ReasoningResponse<TCanonical>> {
  const envelope = enrichEnvelope(request.envelope);
  return {
    envelope,
    explanations: envelope.explanations ?? [],
  };
}
