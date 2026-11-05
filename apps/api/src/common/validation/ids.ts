import { z } from "zod";

/** PostgreSQL INTEGER / JS safe-integer upper bound for public IDs. */
export const MAX_DB_INT = 2_147_483_647;

/**
 * Positive database ID from path/query/JSON.
 * Accepts numbers or digit-only strings. Never coerces booleans, arrays, or objects.
 */
export const positiveIntIdSchema = createPositiveIntIdSchema("ID", "ID is invalid.");

export function positiveIntIdField(label: string) {
  return createPositiveIntIdSchema(label, `${label} is required.`);
}

function createPositiveIntIdSchema(label: string, missingMessage: string) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value,
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

/** Parse JWT claim / string form of an integer ID. */
export function parsePositiveIntId(raw: unknown): number | null {
  if (typeof raw === "number") {
    if (!Number.isSafeInteger(raw) || raw < 1 || raw > MAX_DB_INT) {
      return null;
    }
    return raw;
  }
  if (typeof raw !== "string" || !/^[1-9]\d*$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > MAX_DB_INT) {
    return null;
  }
  return value;
}
