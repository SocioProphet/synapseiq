import { collect } from "./index";
import { validateCanonicalEnvelope } from "../../../packages/contracts/src/validators";
import { IdentityFirmographicAdapter } from "../../../packages/enrichment/src/adapters/identity-firmographic";
import { generateRecordId } from "../../../packages/utils/src";
import type { CanonicalEnvelope } from "../../../packages/contracts/src/envelope";
import type { AdapterContext } from "../../../packages/contracts/src/adapter";

export interface IdentityFirmographicCollectResult {
  accepted: boolean;
  envelopes: CanonicalEnvelope[];
}

export async function collectIdentityFirmographic(
  input: unknown,
): Promise<IdentityFirmographicCollectResult> {
  const ctx: AdapterContext = {
    trace_id: generateRecordId(),
    environment: "dev",
  };

  const adapter = new IdentityFirmographicAdapter();
  const envelopes = await collect(input, ctx, { adapter });

  for (const envelope of envelopes) {
    const validation = validateCanonicalEnvelope(envelope);
    if (!validation.ok) {
      throw new Error(
        `Collector produced invalid canonical envelope: ${validation.issues.map((i) => `${i.path}:${i.message}`).join("; ")}`,
      );
    }
  }

  return {
    accepted: true,
    envelopes,
  };
}
