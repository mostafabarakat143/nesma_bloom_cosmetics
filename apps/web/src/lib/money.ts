import { createValidation } from "@/shared/validation";

const defaultValidation = createValidation();

export const PRICE_MINOR_MAX = defaultValidation.limits.id;

export function formatMinorPrice(priceMinor: number, currency: string): string {
  const major = Math.trunc(priceMinor / 100);
  const minor = Math.abs(priceMinor % 100);
  return `${major}.${String(minor).padStart(2, "0")} ${currency}`;
}

export function minorToEgpInput(priceMinor: number): string {
  const major = Math.trunc(priceMinor / 100);
  const fraction = Math.abs(priceMinor % 100);
  return `${major}.${String(fraction).padStart(2, "0")}`;
}

export type EgpParseResult =
  | { ok: true; minor: number; }
  | { ok: false; reason: "empty" | "invalid"; };

export function parseEgpToMinor(raw: string): EgpParseResult {
  const parsed = defaultValidation.catalog.price().safeParse(raw);
  if (!parsed.success) return { ok: false, reason: "invalid" };
  return parsed.data === null ? { ok: false, reason: "empty" } : { ok: true, minor: parsed.data };
}
