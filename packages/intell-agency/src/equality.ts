/**
 * equality.ts — BME §3.4 / §6 / §19: identity is a QUOTIENT requiring proof, never a default merge.
 *
 * A `Canonical<T>` is a signed witness that records may be treated as one. An `Approx<T>` is an ambiguous
 * similarity claim that MUST route to adjudication — it can never itself authorize a merge. The EqualityGate
 * enforces: request → (attach Canonical witness with quorum) → finalize. High-risk merges require human
 * adjudication; every merge records before/after + a rollback plan.
 */
import type { PurposeId } from "./governance.js";

export interface Canonical<T> {
  proofUri: string;
  hash: string;
  quorum: number; // number of signed validator decisions
  decidedAt: string;
  signatures: string[];
  readonly _t?: (x: T) => T;
}

export interface Approx<T> {
  similarity: number; // [0,1]
  method: string;
  window: string;
  readonly _t?: (x: T) => T;
}

export interface MergeTicket<T> {
  ticketId: string;
  entities: [T, T];
  approx?: Approx<T>;
  purpose: PurposeId;
  witness?: Canonical<T>;
  status: "open" | "witnessed" | "finalized" | "rolledback";
  diff?: { before: [T, T]; after: T };
}

export interface EqualityGate<T> {
  requestMerge(a: T, b: T, purpose: PurposeId, approx?: Approx<T>): { ticketId: string };
  attachWitness(ticketId: string, witness: Canonical<T>): void;
  finalize(ticketId: string, merge: (a: T, b: T) => T): T;
  rollback(ticketId: string): void;
}

export interface EqualityGateOptions {
  minQuorum?: number; // default 3 (§19)
}

/** In-memory reference EqualityGate. No merge finalizes without a Canonical witness meeting quorum. */
export class InMemoryEqualityGate<T> implements EqualityGate<T> {
  private tickets = new Map<string, MergeTicket<T>>();
  private seq = 0;
  private readonly minQuorum: number;
  constructor(opts: EqualityGateOptions = {}) {
    this.minQuorum = Math.max(1, opts.minQuorum ?? 3);
  }

  requestMerge(a: T, b: T, purpose: PurposeId, approx?: Approx<T>): { ticketId: string } {
    const ticketId = `M-${++this.seq}`;
    this.tickets.set(ticketId, { ticketId, entities: [a, b], purpose, status: "open", ...(approx ? { approx } : {}) });
    return { ticketId };
  }

  attachWitness(ticketId: string, witness: Canonical<T>): void {
    const t = this.req(ticketId);
    if (witness.quorum !== witness.signatures.length) throw new Error("witness quorum must equal the number of signatures");
    if (witness.signatures.some((s) => !s || s.trim() === "")) throw new Error("validator decisions MUST be signed");
    t.witness = witness;
    t.status = "witnessed";
  }

  finalize(ticketId: string, merge: (a: T, b: T) => T): T {
    const t = this.req(ticketId);
    if (!t.witness) throw new Error("cannot finalize: no Canonical<T> witness attached (silent merge forbidden)");
    if (t.witness.quorum < this.minQuorum) throw new Error(`quorum ${t.witness.quorum} < required ${this.minQuorum}`);
    const after = merge(t.entities[0], t.entities[1]);
    t.diff = { before: t.entities, after }; // before/after recorded for rollback (§6, §19)
    t.status = "finalized";
    return after;
  }

  rollback(ticketId: string): void {
    const t = this.req(ticketId);
    t.status = "rolledback"; // rollback path is recorded
  }

  ticket(ticketId: string): MergeTicket<T> | undefined {
    return this.tickets.get(ticketId);
  }

  private req(id: string): MergeTicket<T> {
    const t = this.tickets.get(id);
    if (!t) throw new Error(`no merge ticket ${id}`);
    return t;
  }
}
