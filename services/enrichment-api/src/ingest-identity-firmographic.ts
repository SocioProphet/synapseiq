import { collectIdentityFirmographic } from "../../enrichment-collector/src/run-identity-firmographic";
import type { CanonicalEnvelope } from "../../../packages/contracts/src/envelope";

export interface IdentityFirmographicIngestRequest {
  payload: unknown;
}

export interface IdentityFirmographicIngestResponse {
  accepted: boolean;
  envelopes: CanonicalEnvelope[];
}

export async function ingestIdentityFirmographic(
  request: IdentityFirmographicIngestRequest,
): Promise<IdentityFirmographicIngestResponse> {
  const result = await collectIdentityFirmographic(request.payload);
  return {
    accepted: result.accepted,
    envelopes: result.envelopes,
  };
}
