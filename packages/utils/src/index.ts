export function isoNow(): string {
  return new Date().toISOString();
}

export function generateRecordId(): string {
  // Avoid the DOM `Crypto` type (base tsconfig lib is ES2022, no DOM) and the
  // implicit-any index on globalThis — reference only the one method we use.
  const cryptoLike = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoLike?.randomUUID) {
    return cryptoLike.randomUUID();
  }

  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
