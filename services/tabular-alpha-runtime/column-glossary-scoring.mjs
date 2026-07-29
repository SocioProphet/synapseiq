/**
 * Column-to-glossary scorer, vendored across the tabular-alpha services.
 *
 * Canonical source: services/_vendor/column-glossary-scoring.mjs.
 * Vendored copies: services/tabular-alpha-{api,runtime}/column-glossary-scoring.mjs,
 * kept byte-identical to the canonical file. If you are reading this in a
 * service directory, treat this file as read-only and edit the canonical one;
 * `tools/check_vendored_scorer_copies.mjs` enforces the identity in CI.
 *
 * Why vendored rather than imported. The tabular-alpha services are
 * deliberately standalone: `services/tabular-alpha-runtime/README.md` states it
 * is "intentionally separate from the broader TypeScript service package so that
 * Cloud Run source deployment can be used with minimal friction", and it has no
 * package.json at all. Making them depend on @socioprophet/synapseiq-enrichment
 * would defeat that. So the logic is vendored — one canonical file here, copied
 * verbatim into each service directory that deploys on its own.
 *
 * Copies MUST stay byte-identical to this file.
 * `tools/check_vendored_scorer_copies.mjs` enforces that in CI; drifting copies
 * of scoring logic are exactly how four services came to return
 * `candidates[0]` with a hardcoded 0.5 while the package had been fixed.
 *
 * Behaviour mirrors packages/enrichment/src/column-glossary-scoring.ts. Keep the
 * two in step; the TypeScript version is the reference implementation and this
 * is its dependency-free ESM mirror.
 */

export const ABBREVIATIONS = Object.freeze({
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
});

const STOPWORDS = new Set([
  "a", "an", "the", "of", "on", "in", "at", "to", "for", "by", "is", "was", "or", "and",
]);

export const MIN_SCORE = 0.34;
export const RECALL_WEIGHT = 0.75;
export const PRECISION_WEIGHT = 0.25;
export const TIE_FLOOR = 0.6;
export const TIE_MARGIN_SATURATION = 0.2;

/** Split on underscores, hyphens, spaces and camelCase humps — both sides. */
export function tokenizeColumn(columnName) {
  return String(columnName)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((t) => t.length > 0)
    .map((t) => t.toLowerCase());
}

export function expandColumnName(columnName) {
  const applied = [];
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

function contentTokens(phrase) {
  return tokenizeColumn(phrase).filter((t) => !STOPWORDS.has(t));
}

function scoreAgainstTokens(columnTokens, candidate) {
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

export function scoreCandidate(expandedColumn, candidate) {
  return scoreAgainstTokens(new Set(contentTokens(expandedColumn)), candidate);
}

/** Rank glossary candidates for one column, abstaining when nothing fits. */
export function mapColumnToGlossary(columnName, candidates) {
  const { expanded, expansionsApplied } = expandColumnName(columnName);
  const columnTokens = new Set(contentTokens(expanded));

  const ranked = (candidates ?? [])
    .map((candidate) => {
      const { score, matchedTokens } = scoreAgainstTokens(columnTokens, candidate);
      return { candidate, score, matchedTokens, evidenceType: "LEXICAL" };
    })
    // Codepoint comparison, NOT localeCompare: collation varies with host ICU
    // data, which would make ranking environment-dependent.
    .sort((a, b) => (b.score - a.score) || (a.candidate < b.candidate ? -1 : a.candidate > b.candidate ? 1 : 0));

  if (ranked.length === 0) {
    return {
      target: null, confidence: 0, ranked, expandedColumn: expanded, expansionsApplied,
      unmappedReason: "no glossary candidates supplied",
    };
  }

  const best = ranked[0];
  if (best.score < MIN_SCORE) {
    return {
      target: null, confidence: Number(best.score.toFixed(4)), ranked,
      expandedColumn: expanded, expansionsApplied,
      unmappedReason: `best candidate scored ${best.score.toFixed(4)} < MIN_SCORE ${MIN_SCORE}`,
    };
  }

  const runnerUp = ranked[1];
  const margin = runnerUp ? best.score - runnerUp.score : best.score;
  const confidence = Number(
    Math.min(1, best.score * (TIE_FLOOR + (1 - TIE_FLOOR) * Math.min(1, margin / TIE_MARGIN_SATURATION))).toFixed(4),
  );

  return { target: best.candidate, confidence, ranked, expandedColumn: expanded, expansionsApplied };
}
