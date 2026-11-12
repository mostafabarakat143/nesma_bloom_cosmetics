export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function slugifyFromName(name: string, maxLength = 160): string {
  const slug = normalizeSlug(name);
  if (!slug) {
    throw new Error("Unable to generate slug from name");
  }
  return slug.slice(0, maxLength);
}
