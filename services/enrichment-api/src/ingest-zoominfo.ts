import { collectZoomInfo } from "../../enrichment-collector/src/run-zoominfo";
import type { CanonicalEnvelope } from "../../../packages/contracts/src/envelope";

export interface ZoomInfoIngestRequest {
  payload: unknown;
}

export interface ZoomInfoIngestResponse {
  accepted: boolean;
  envelopes: CanonicalEnvelope[];
}

export async function ingestZoomInfo(
  request: ZoomInfoIngestRequest,
): Promise<ZoomInfoIngestResponse> {
  const result = await collectZoomInfo(request.payload);
  return {
    accepted: result.accepted,
    envelopes: result.envelopes,
  };
}
