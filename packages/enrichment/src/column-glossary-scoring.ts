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

/** Scoring weights. Recall against the column's own tokens outranks precision
 *  against the label — see scoreCandidate() for why. */
export const RECALL_WEIGHT = 0.75;
export const PRECISION_WEIGHT = 0.25;

/** Near-tie discounting. A winner is scaled between TIE_FLOOR and 1 according to
 *  how far clear of the runner-up it is, saturating at TIE_MARGIN_SATURATION.
 *  Named rather than embedded: constants that move confidence must be as visible
 *  and as tunable as MIN_SCORE. */
export const TIE_FLOOR = 0.6;
export const TIE_MARGIN_SATURATION = 0.2;

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

/** Split on underscores, hyphens, spaces, and camelCase humps.
 *
 *  Used for BOTH column names and glossary labels. Splitting only one side would
 *  make a label written `PlannedEndDate` collapse to a single token and score
 *  zero overlap against `planned end date` — the right answer, unmatchable. */
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
  // Same tokenizer as the column side: camelCase-aware, so `PlannedEndDate` and
  // `Planned End Date` reduce to the same tokens.
  return tokenizeColumn(phrase).filter((t) => !STOPWORDS.has(t));
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
  return scoreAgainstTokens(new Set(contentTokens(expandedColumn)), candidate);
}

/** Scoring core over a pre-computed column token set, so mapColumnToGlossary()
 *  does the column-side work once rather than per candidate. */
function scoreAgainstTokens(columnTokens: ReadonlySet<string>, candidate: string): { score: number; matchedTokens: string[] } {
  const candidateSet = new Set(contentTokens(candidate));
  if (columnTokens.size === 0 || candidateSet.size === 0) {
    return { score: 0, matchedTokens: [] };
  }

  const matchedTokens = [...columnTokens].filter((t) => candidateSet.has(t));
  if (matchedTokens.length === 0) return { score: 0, matchedTokens: [] };

  const recall = matchedTokens.length / columnTokens.size;
  const precision = matchedTokens.length / candidateSet.size;
  const score = RECALL_WEIGHT * recall + PRECISION_WEIGHT * precision;

  return { score: Math.min(1, Number(score.toFixed(4))), matchedTokens };
}

/** Rank glossary candidates for one column, abstaining when nothing fits. */
export function mapColumnToGlossary(columnName: string, candidates: readonly string[]): ColumnMappingResult {
  const { expanded, expansionsApplied } = expandColumnName(columnName);

  const columnTokens = new Set(contentTokens(expanded));
  const ranked: ScoredCandidate[] = candidates
    .map((candidate) => {
      const { score, matchedTokens } = scoreAgainstTokens(columnTokens, candidate);
      return { candidate, score, matchedTokens, evidenceType: "LEXICAL" as const };
    })
    // Plain codepoint comparison, NOT localeCompare: collation varies with the
    // host's ICU data, which would make ranking environment-dependent and break
    // the determinism this module promises.
    .sort((a, b) => (b.score - a.score) || (a.candidate < b.candidate ? -1 : a.candidate > b.candidate ? 1 : 0));

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
  const confidence = Number(
    Math.min(1, best.score * (TIE_FLOOR + (1 - TIE_FLOOR) * Math.min(1, margin / TIE_MARGIN_SATURATION))).toFixed(4),
  );

  return { target: best.candidate, confidence, ranked, expandedColumn: expanded, expansionsApplied };
}
