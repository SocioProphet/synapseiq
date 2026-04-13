export function isoNow(): string {
  return new Date().toISOString();
}

export function generateRecordId(): string {
  const cryptoLike = globalThis.crypto as Crypto | undefined;
  if (cryptoLike?.randomUUID) {
    return cryptoLike.randomUUID();
  }

  return `rec_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function notEmpty<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
