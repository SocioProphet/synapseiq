import { collectTabularGlossary } from "../../enrichment-collector/src/run-tabular-glossary";

export async function ingestTabular(request) {
  return collectTabularGlossary(request.payload);
}
