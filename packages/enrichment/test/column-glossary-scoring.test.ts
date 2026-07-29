import test from "node:test";
import assert from "node:assert/strict";
import {
  ABBREVIATIONS,
  MIN_SCORE,
  PRECISION_WEIGHT,
  RECALL_WEIGHT,
  TIE_FLOOR,
  TIE_MARGIN_SATURATION,
  expandColumnName,
  mapColumnToGlossary,
  scoreCandidate,
  tokenizeColumn,
} from "../src/column-glossary-scoring";

// The IBM C2C worked example: PLN_END_DT in a COMMUNICATION table should reach
// "Communication Expected End Date", not whichever candidate happens to be first.
const GLOSSARY = [
  "Communication Expected End Date",
  "Actual Start Date",
  "Employee Identifier",
  "Basic Data Income",
];

test("tokenizes underscores, hyphens and camelCase", () => {
  assert.deepEqual(tokenizeColumn("PLN_END_DT"), ["pln", "end", "dt"]);
  assert.deepEqual(tokenizeColumn("plannedEndDate"), ["planned", "end", "date"]);
  assert.deepEqual(tokenizeColumn("ACT-STRT_DT"), ["act", "strt", "dt"]);
});

test("expands shorthand and reports which rules fired", () => {
  const { expanded, expansionsApplied } = expandColumnName("PLN_END_DT");
  assert.equal(expanded, "planned end date");
  assert.deepEqual(expansionsApplied, ["pln->planned", "dt->date"]);
});

test("expansions are auditable, not silent", () => {
  const { expansionsApplied } = expandColumnName("VNDR_TR_CD");
  assert.deepEqual(expansionsApplied, ["vndr->vendor", "tr->transaction", "cd->code"]);
});

test("scoring rewards covering the column's own tokens", () => {
  const { score, matchedTokens } = scoreCandidate("planned end date", "Communication Expected End Date");
  assert.ok(score > 0, "shares 'end' and 'date'");
  assert.deepEqual(matchedTokens.sort(), ["date", "end"]);
});

test("a verbose correct label is not penalised below a terse wrong one", () => {
  const verboseCorrect = scoreCandidate("planned end date", "Communication Expected End Date").score;
  const terseWrong = scoreCandidate("planned end date", "Employee Identifier").score;
  assert.ok(verboseCorrect > terseWrong);
});

test("PLN_END_DT maps to the expected-end-date concept, not candidate[0]", () => {
  // Deliberately place the right answer LAST: index zero must not win by position.
  const shuffled = [...GLOSSARY.slice(1), GLOSSARY[0]!];
  const result = mapColumnToGlossary("PLN_END_DT", shuffled);
  assert.equal(result.target, "Communication Expected End Date");
  assert.equal(result.ranked[0]!.candidate, "Communication Expected End Date");
});

test("confidence is derived from the score, never a constant", () => {
  const strong = mapColumnToGlossary("EMPE_ID", ["Employee Identifier", "Basic Data Income"]);
  const weaker = mapColumnToGlossary("PLN_END_DT", GLOSSARY);
  assert.notEqual(strong.confidence, 0.5, "the old adapter hardcoded 0.5");
  assert.ok(strong.confidence > weaker.confidence, "a cleaner match must score higher");
});

test("abstains rather than returning the least-bad candidate", () => {
  const result = mapColumnToGlossary("XQZ_9", GLOSSARY);
  assert.equal(result.target, null);
  assert.ok(result.unmappedReason);
  assert.ok(result.confidence < MIN_SCORE);
});

test("abstains when no candidates are supplied", () => {
  const result = mapColumnToGlossary("PLN_END_DT", []);
  assert.equal(result.target, null);
  assert.equal(result.confidence, 0);
  assert.match(result.unmappedReason!, /no glossary candidates/);
});

test("a near-tie is discounted so ambiguity cannot present as certainty", () => {
  const tie = mapColumnToGlossary("END_DT", ["Contract End Date", "Coverage End Date"]);
  const clear = mapColumnToGlossary("END_DT", ["Contract End Date", "Employee Identifier"]);
  assert.ok(tie.target !== null && clear.target !== null);
  assert.ok(clear.confidence > tie.confidence, "a contested top-1 must not read as confident");
});

test("ranking is deterministic under equal scores", () => {
  const a = mapColumnToGlossary("END_DT", ["B End Date", "A End Date"]);
  const b = mapColumnToGlossary("END_DT", ["A End Date", "B End Date"]);
  assert.deepEqual(a.ranked.map((r) => r.candidate), b.ranked.map((r) => r.candidate));
});

test("every scored candidate carries its evidence type", () => {
  const result = mapColumnToGlossary("PLN_END_DT", GLOSSARY);
  for (const row of result.ranked) {
    assert.equal(row.evidenceType, "LEXICAL", "this stage embeds nothing and must not claim to");
  }
});

test("abbreviation table has no identity entries", () => {
  for (const [short, long] of Object.entries(ABBREVIATIONS)) {
    assert.notEqual(short, long, `${short} expands to itself`);
  }
});

test("camelCase glossary labels tokenize like spaced ones", () => {
  const spaced = scoreCandidate("planned end date", "Planned End Date").score;
  const camel = scoreCandidate("planned end date", "PlannedEndDate").score;
  assert.equal(camel, spaced, "a camelCase label must not collapse to one token");
  assert.ok(camel > 0);
});

test("ordering does not depend on host locale collation", () => {
  // Codepoint ordering, not localeCompare: ICU data varies by environment.
  const r = mapColumnToGlossary("END_DT", ["b End Date", "B End Date", "a End Date"]);
  const tied = r.ranked.filter((x) => x.score === r.ranked[0]!.score).map((x) => x.candidate);
  assert.deepEqual(tied, [...tied].sort());
});

test("tie-discount constants are exported and bound the confidence", () => {
  assert.ok(TIE_FLOOR > 0 && TIE_FLOOR < 1);
  assert.ok(TIE_MARGIN_SATURATION > 0);
  assert.equal(Number((RECALL_WEIGHT + PRECISION_WEIGHT).toFixed(6)), 1);
  // Scores and confidences are rounded to 4dp, so compare at that resolution:
  // an exact bound of 0.55002 legitimately reports as 0.55.
  const tie = mapColumnToGlossary("END_DT", ["Contract End Date", "Coverage End Date"]);
  const ROUNDING = 5e-5;
  assert.ok(tie.confidence >= tie.ranked[0]!.score * TIE_FLOOR - ROUNDING);
  assert.ok(tie.confidence <= tie.ranked[0]!.score + ROUNDING);
});
