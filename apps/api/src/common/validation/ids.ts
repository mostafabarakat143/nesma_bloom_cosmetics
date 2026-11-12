import { z } from "zod";

export const MAX_DB_INT = 2_147_483_647;

const POSITIVE_INT_ID_PATTERN = /^[1-9]\d*$/;

export const positiveIntIdSchema = createPositiveIntIdSchema("ID", "ID is invalid.");

export function positiveIntIdField(label: string) {
  return createPositiveIntIdSchema(label, `${label} is required.`);
}

function createPositiveIntIdSchema(label: string, missingMessage: string) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && POSITIVE_INT_ID_PATTERN.test(value)
        ? Number(value)
        : value,
    z
      .number({
        error: (issue) =>
          issue.input === undefined ? missingMessage : `${label} is invalid.`,
      })
      .int(`${label} must be a whole number.`)
      .positive(`${label} must be a positive integer.`)
      .max(MAX_DB_INT, `${label} is out of range.`),
  );
}

export function parsePositiveIntId(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isSafeInteger(raw) || raw < 1 || raw > MAX_DB_INT) {
      return null;
    }
    return raw;
  }
  if (typeof raw !== "string" || !POSITIVE_INT_ID_PATTERN.test(raw)) {
    return null;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > MAX_DB_INT) {
    return null;
  }
  return value;
}
