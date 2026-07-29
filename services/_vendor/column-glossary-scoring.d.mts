// Type declarations for the vendored column-glossary scorer.
//
// The runtime source is a dependency-free .mjs so it can be deployed alongside
// standalone Cloud Run services (no package.json build step). The typechecked
// service (services/tabular-alpha-api/src/server.ts) needs declarations to
// import it under strict TS — hence this sibling .d.mts.
//
// Copies in service directories are kept byte-identical to their .mjs sibling
// alongside the runtime file; tools/check_vendored_scorer_copies.mjs enforces
// that. See the .mjs header for why vendoring is used instead of a workspace
// dependency.

export const MIN_SCORE: number;
export const RECALL_WEIGHT: number;
export const PRECISION_WEIGHT: number;
export const TIE_FLOOR: number;
export const TIE_MARGIN_SATURATION: number;
export const ABBREVIATIONS: Readonly<Record<string, string>>;

export type EvidenceType = "LEXICAL" | "EMBEDDING";

export interface ScoredCandidate {
  candidate: string;
  score: number;
  matchedTokens: string[];
  evidenceType: EvidenceType;
}

export interface ColumnMappingResult {
  target: string | null;
  confidence: number;
  ranked: ScoredCandidate[];
  expandedColumn: string;
  expansionsApplied: string[];
  unmappedReason?: string;
}

export function tokenizeColumn(columnName: string): string[];
export function expandColumnName(columnName: string): { expanded: string; expansionsApplied: string[] };
export function scoreCandidate(expandedColumn: string, candidate: string): { score: number; matchedTokens: string[] };
export function mapColumnToGlossary(columnName: string, candidates: readonly string[]): ColumnMappingResult;
