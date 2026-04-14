import { collect } from "./index";
import { validateCanonicalEnvelope } from "../../../packages/contracts/src/validators";
import { TabularGlossaryAdapter } from "../../../packages/enrichment/src/adapters/tabular-glossary";
import { generateRecordId } from "../../../packages/utils/src";
import type { CanonicalEnvelope } from "../../../packages/contracts/src/envelope";
import type { AdapterContext } from "../../../packages/contracts/src/adapter";

export interface TabularGlossaryCollectResult {
  accepted: boolean;
  envelopes: CanonicalEnvelope[];
}

export async function collectTabularGlossary(
  input: unknown,
): Promise<TabularGlossaryCollectResult> {
  const ctx: AdapterContext = {
    trace_id: generateRecordId(),
    environment: "dev",
  };

  const adapter = new TabularGlossaryAdapter();
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
