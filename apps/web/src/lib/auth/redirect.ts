const FALLBACK = "/shop";
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string") {
    return FALLBACK;
  }

  const trimmed = value.trim();
  if (
    !trimmed.startsWith("/") ||
    trimmed.startsWith("//") ||
    trimmed.startsWith("/\\") ||
    trimmed.includes("\\") ||
    trimmed.includes("://") ||
    trimmed.includes("\0")
  ) {
    return FALLBACK;
  }

  let url: URL;
  try {
    url = new URL(trimmed, "http://nesma.local");
  } catch {
    return FALLBACK;
  }

  if (url.origin !== "http://nesma.local" || url.username || url.password) {
    return FALLBACK;
  }

  if (!url.pathname.startsWith("/") || url.pathname.startsWith("//")) {
    return FALLBACK;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
