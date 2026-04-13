import type { CanonicalEnvelope } from "@socioprophet/synapseiq-contracts";

export function enrichEnvelope<TCanonical = Record<string, unknown>>(
  envelope: CanonicalEnvelope<TCanonical>,
): CanonicalEnvelope<TCanonical> {
  return envelope;
}
