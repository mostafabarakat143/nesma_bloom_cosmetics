export function getApiUrl(): string {
  const url = process.env.API_URL?.trim();

  if (!url) {
    throw new Error("API_URL is required.");
  }

  return url.replace(/\/$/, "");
}
