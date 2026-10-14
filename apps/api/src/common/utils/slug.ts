/**
 * Normalize an explicit slug or derive one from a display name.
 * Output: lowercase kebab-case [a-z0-9]+(?:-[a-z0-9]+)*
 */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function slugifyFromName(name: string): string {
  const slug = normalizeSlug(name);
  if (!slug) {
    throw new Error("Unable to generate slug from name");
  }
  return slug.slice(0, 160);
}
