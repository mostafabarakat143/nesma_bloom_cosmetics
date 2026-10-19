/**
 * Turn the first Zod issue into a single human-readable API message.
 * Prefer schema-level custom messages; fall back to path-aware defaults.
 */

type ZodIssueLike = {
  code: string;
  path: PropertyKey[];
  message: string;
  expected?: unknown;
  format?: string;
  minimum?: number | bigint;
  input?: unknown;
};

type ZodErrorLike = {
  issues: ZodIssueLike[];
};

const FIELD_LABELS: Record<string, string> = {
  email: "Email",
  password: "Password",
  quantity: "Quantity",
  name: "Name",
  message: "Message",
  firstName: "First name",
  lastName: "Last name",
  phone: "Phone",
  productId: "Product ID",
  categoryId: "Category ID",
  subcategoryId: "Subcategory ID",
  imageId: "Image ID",
  userId: "User ID",
  url: "Image URL",
  sku: "SKU",
  slug: "Slug",
  items: "Items",
  priceMinor: "Price",
  stockQty: "Stock quantity",
  sortOrder: "Sort order",
  altText: "Alt text",
  description: "Description",
  status: "Status",
  isAvailable: "Availability",
  isPrimary: "Primary flag",
  id: "ID",
};

function leafPath(path: PropertyKey[]): string {
  for (let i = path.length - 1; i >= 0; i -= 1) {
    const part = path[i];
    if (typeof part === "number") continue;
    const text = String(part);
    if (/^\d+$/.test(text)) continue;
    return text;
  }
  return "";
}

function fieldLabel(path: PropertyKey[]): string {
  const leaf = leafPath(path);
  if (!leaf) return "Value";
  return FIELD_LABELS[leaf] ?? humanize(leaf);
}

function humanize(raw: string): string {
  const spaced = raw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!spaced) return "Value";
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function ensureSentence(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return "Validation failed.";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function isGenericZodMessage(message: string): boolean {
  return (
    message.startsWith("Invalid input:") ||
    message.startsWith("Too small:") ||
    message.startsWith("Too big:") ||
    message.startsWith("Invalid option:") ||
    message === "Invalid email address" ||
    message === "Required" ||
    message === "Invalid"
  );
}

function isMissingInput(issue: ZodIssueLike): boolean {
  if (issue.code !== "invalid_type") return false;
  if (issue.input === undefined) return true;
  return /received undefined$/i.test(issue.message);
}

export function formatZodErrorMessage(error: ZodErrorLike): string {
  const issue = error.issues[0];
  if (!issue) {
    return "Validation failed.";
  }

  if (issue.message && !isGenericZodMessage(issue.message)) {
    return ensureSentence(issue.message);
  }

  const label = fieldLabel(issue.path);

  if (isMissingInput(issue)) {
    return `${label} is required.`;
  }

  if (issue.code === "invalid_format" && issue.format === "email") {
    return "Please enter a valid email address.";
  }

  if (issue.code === "invalid_format" && issue.format === "uuid") {
    return `${label} is invalid.`;
  }

  if (issue.code === "too_small") {
    if (issue.path.includes("password")) {
      return "Password must be at least 8 characters.";
    }
    return `${label} is invalid.`;
  }

  if (issue.code === "too_big") {
    return `${label} is invalid.`;
  }

  if (issue.code === "unrecognized_keys") {
    return "Unexpected fields are not allowed.";
  }

  if (issue.code === "invalid_type" || issue.code === "invalid_format") {
    return `${label} is invalid.`;
  }

  return ensureSentence(issue.message || "Validation failed.");
}
