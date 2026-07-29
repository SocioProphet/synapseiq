import { collectIdentity-Firmographic } from "../../enrichment-collector/src/run-identity-firmographic";
import type { CanonicalEnvelope } from "../../../packages/contracts/src/envelope";

export interface Identity-FirmographicIngestRequest {
  payload: unknown;
}

export interface Identity-FirmographicIngestResponse {
  accepted: boolean;
  envelopes: CanonicalEnvelope[];
}

export async function ingestIdentity-Firmographic(
  request: Identity-FirmographicIngestRequest,
): Promise<Identity-FirmographicIngestResponse> {
  const result = await collectIdentity-Firmographic(request.payload);
  return {
    accepted: result.accepted,
    envelopes: result.envelopes,
  };
}
