/** Largest integer PostgreSQL can store in a signed 32-bit column. */
export const PRICE_MINOR_MAX = 2_147_483_647;

/** Format integer minor units. 1500 piastres and EGP become "15.00 EGP". */
export function formatMinorPrice(priceMinor: number, currency: string): string {
  const major = Math.trunc(priceMinor / 100);
  const minor = Math.abs(priceMinor % 100);
  return `${major}.${String(minor).padStart(2, "0")} ${currency}`;
}

/** Convert integer piastres to the EGP value shown in a price input. 1500 becomes "15.00". */
export function minorToEgpInput(priceMinor: number): string {
  const major = Math.trunc(priceMinor / 100);
  const fraction = Math.abs(priceMinor % 100);
  return `${major}.${String(fraction).padStart(2, "0")}`;
}

export type EgpParseResult =
  | { ok: true; minor: number }
  | { ok: false; reason: "empty" | "invalid" };

/**
 * Convert a typed EGP amount to integer piastres without floating-point math.
 * Accepts "15" and "15.50". Rejects negatives, extra decimals, and overflow.
 */
export function parseEgpToMinor(raw: string): EgpParseResult {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, reason: "empty" };
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { ok: false, reason: "invalid" };
  }

  const [majorPart, fractionPart = ""] = trimmed.split(".");
  if (majorPart.length > 10) {
    return { ok: false, reason: "invalid" };
  }

  const major = Number(majorPart);
  const fraction = Number(fractionPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(major) || !Number.isSafeInteger(fraction)) {
    return { ok: false, reason: "invalid" };
  }

  const minor = major * 100 + fraction;
  if (!Number.isSafeInteger(minor) || minor > PRICE_MINOR_MAX) {
    return { ok: false, reason: "invalid" };
  }

  return { ok: true, minor };
}
