/**
 * numeric.ts — BME §3.5: numeric claims that affect policy/scoring/decisions MUST carry tolerance semantics, and
 * a guard whose state can flip within tolerance is UNSTABLE and must be flagged (the SMT/boundary-flip check).
 */

/** |x̂ − x| ≤ ε — the claim x̂ approximates x within ε. */
export function withinTolerance(xhat: number, x: number, epsilon: number): boolean {
  return Math.abs(xhat - x) <= epsilon;
}

/**
 * A strict guard `value > threshold` is STABLE only if value is at least `margin` past the threshold AND margin
 * comfortably exceeds the numeric tolerance ε (so float error / ulp wobble cannot flip the decision). Returns true
 * when the boundary is UNSTABLE — i.e. the decision could flip within tolerance and must be SMT-checked / blocked.
 */
export function boundaryFlipsUnsafe(value: number, threshold: number, margin: number, epsilon: number): boolean {
  if (margin < epsilon) return true; // margin smaller than the error bar → inherently unstable
  return Math.abs(value - threshold) < margin; // within the guard band → could flip
}

/** A decision gate that returns its verdict AND whether that verdict is numerically trustworthy. */
export function stableGuard(value: number, threshold: number, margin: number, epsilon: number): { pass: boolean; stable: boolean } {
  return { pass: value - threshold > margin, stable: !boundaryFlipsUnsafe(value, threshold, margin, epsilon) };
}
