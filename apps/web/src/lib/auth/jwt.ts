const JWT_PART = /^[A-Za-z0-9_-]+$/;
export const SESSION_MAX_AGE_SECONDS = 604_800;

export function isPlausibleJwt(token: string): boolean {
  if (token.length < 20 || token.length > 4096) {
    return false;
  }
  const parts = token.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0 && JWT_PART.test(part));
}

/** Reads exp only to size the cookie. Express remains the verifier. */
export function sessionMaxAgeSeconds(
  token: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): number {
  const part = token.split(".")[1];
  if (!part) {
    return 0;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(part, "base64url").toString("utf8"),
    ) as { exp?: unknown };
    if (typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
      return 0;
    }
    const remaining = payload.exp - nowSeconds;
    if (remaining <= 0) {
      return 0;
    }
    return Math.min(Math.floor(remaining), SESSION_MAX_AGE_SECONDS);
  } catch {
    return 0;
  }
}
