/**
 * Column-to-concept scoring: rank business-glossary candidates for a database
 * column by lexical evidence.
 *
 * WHAT THIS IS. The first rung of the column-to-concept (C2C) workflow: expand
 * shorthand column names (`PLN_END_DT` -> "planned end date"), then score each
 * glossary candidate against the expanded form. It is deterministic, dependency
 * free, and LEXICAL ONLY — it does not embed anything and does not claim to.
 *
 * WHAT IT REPLACES. The previous adapter took `glossary_candidates` supplied by
 * the caller, returned `candidates[0]`, and stamped `confidence: 0.5` on the
 * result. Nothing was computed: the caller did the mapping and the confidence
 * was a constant wearing a number's clothes. Index zero is not a ranking, and a
 * fixed 0.5 is not a confidence.
 *
 * HONESTY RULES, which are the point of this module:
 *   - Confidence is derived from the score that produced the match, never fixed.
 *   - A match below `MIN_SCORE` yields `unmapped` rather than the least-bad
 *     candidate. Returning a weak top-1 as though it were an answer is how a
 *     ranker launders "I don't know" into a mapping.
 *   - Every result carries the evidence that produced it (which tokens matched,
 *     which expansions fired), so a mapping can be audited rather than trusted.
 *   - `evidenceType` is `LEXICAL`, matching the semantic-serdes linkage
 *     vocabulary. When an embedding stage lands it reports `EMBEDDING` and the
 *     two are distinguishable in the record — a caller must always be able to
 *     tell which kind of evidence backed a mapping.
 */

/** Abbreviation expansions for database column shorthand. Deliberately small and
 *  explicit: an expansion nobody can read is an expansion nobody can audit. */
export const ABBREVIATIONS: Readonly<Record<string, string>> = {
  acct: "account", act: "actual", addr: "address", amt: "amount", apprv: "approved",
  bsc: "basic", cd: "code", cmm: "communication", cnt: "count", cst: "customer",
  ctry: "country", cur: "currency", dept: "department", desc: "description",
  dt: "date", dtl: "detail", empe: "employee", emp: "employee",
  flg: "flag", id: "identifier", incom: "income", ind: "indicator", inv: "invoice",
  lst: "last", nbr: "number", num: "number", org: "organization", pct: "percent",
  pln: "planned", prc: "price", prod: "product", qty: "quantity", ref: "reference",
  seq: "sequence", sku: "stock keeping unit", src: "source", strt: "start",
  sts: "status", tms: "timestamp", tot: "total", tr: "transaction", txt: "text",
  typ: "type", usr: "user", vld: "valid", vndr: "vendor",
};

/** Tokens carrying no discriminating meaning in a glossary label. */
const STOPWORDS: ReadonlySet<string> = new Set([
  "a", "an", "the", "of", "on", "in", "at", "to", "for", "by", "is", "was", "or", "and",
]);

/** Below this score the column is reported UNMAPPED rather than force-matched. */
export const MIN_SCORE = 0.34;

export type EvidenceType = "LEXICAL" | "EMBEDDING";

export interface ScoredCandidate {
  candidate: string;
  score: number;
  matchedTokens: string[];
  evidenceType: EvidenceType;
}

export interface ColumnMappingResult {
  /** Best candidate, or null when nothing cleared MIN_SCORE. */
  target: string | null;
  /** Confidence derived from the winning score — never a constant. */
  confidence: number;
  /** All candidates, ranked. Retained so a reviewer can see what was rejected. */
  ranked: ScoredCandidate[];
  expandedColumn: string;
  expansionsApplied: string[];
  /** Why there is no target, when there isn't one. */
  unmappedReason?: string;
}

/** Split a column name on underscores, hyphens, spaces, and camelCase humps. */
export function tokenizeColumn(columnName: string): string[] {
  return columnName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase());
}

/** Expand shorthand tokens. Returns the expanded phrase and which rules fired. */
export function expandColumnName(columnName: string): { expanded: string; expansionsApplied: string[] } {
  const applied: string[] = [];
  const expanded = tokenizeColumn(columnName).map((token) => {
    const replacement = ABBREVIATIONS[token];
    if (replacement && replacement !== token) {
      applied.push(`${token}->${replacement}`);
      return replacement;
    }
    return token;
  });
  return { expanded: expanded.join(" "), expansionsApplied: applied };
}

function contentTokens(phrase: string): string[] {
  return phrase
    .split(/[^A-Za-z0-9]+/)
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase())
    .filter((t) => !STOPWORDS.has(t));
}

/**
 * Similarity between an expanded column phrase and a glossary label.
 *
 * Weighted token overlap: recall against the column's own tokens matters more
 * than precision against the label, because glossary labels are habitually more
 * verbose than column names ("Communication Expected End Date" vs PLN_END_DT).
 * Penalising a label for carrying extra words would rank the terse wrong answer
 * above the wordy right one.
 */
export function scoreCandidate(expandedColumn: string, candidate: string): { score: number; matchedTokens: string[] } {
  const columnTokens = contentTokens(expandedColumn);
  const candidateTokens = contentTokens(candidate);
  if (columnTokens.length === 0 || candidateTokens.length === 0) {
    return { score: 0, matchedTokens: [] };
  }

  const candidateSet = new Set(candidateTokens);
  const matchedTokens = [...new Set(columnTokens.filter((t) => candidateSet.has(t)))];
  if (matchedTokens.length === 0) return { score: 0, matchedTokens: [] };

  const recall = matchedTokens.length / new Set(columnTokens).size;
  const precision = matchedTokens.length / candidateSet.size;
  const score = 0.75 * recall + 0.25 * precision;

  return { score: Math.min(1, Number(score.toFixed(4))), matchedTokens };
}

/** Rank glossary candidates for one column, abstaining when nothing fits. */
export function mapColumnToGlossary(columnName: string, candidates: readonly string[]): ColumnMappingResult {
  const { expanded, expansionsApplied } = expandColumnName(columnName);

  const ranked: ScoredCandidate[] = candidates
    .map((candidate) => {
      const { score, matchedTokens } = scoreCandidate(expanded, candidate);
      return { candidate, score, matchedTokens, evidenceType: "LEXICAL" as const };
    })
    .sort((a, b) => (b.score - a.score) || a.candidate.localeCompare(b.candidate));

  if (ranked.length === 0) {
    return {
      target: null, confidence: 0, ranked, expandedColumn: expanded, expansionsApplied,
      unmappedReason: "no glossary candidates supplied",
    };
  }

  const best = ranked[0]!;
  if (best.score < MIN_SCORE) {
    return {
      target: null, confidence: Number(best.score.toFixed(4)), ranked,
      expandedColumn: expanded, expansionsApplied,
      unmappedReason: `best candidate scored ${best.score.toFixed(4)} < MIN_SCORE ${MIN_SCORE}`,
    };
  }

  // A near-tie is not a confident answer: report the winner but discount it by
  // how close the runner-up came, so an ambiguous mapping cannot present as sure.
  const runnerUp = ranked[1];
  const margin = runnerUp ? best.score - runnerUp.score : best.score;
  const confidence = Number(Math.min(1, best.score * (0.6 + 0.4 * Math.min(1, margin / 0.2))).toFixed(4));

  return { target: best.candidate, confidence, ranked, expandedColumn: expanded, expansionsApplied };
}
