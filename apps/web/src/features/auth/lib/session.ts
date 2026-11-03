import { parsePublicUser, type PublicUser } from "./credentials";
import { isRecord } from "@/shared/lib/guards";

const JWT_PART = /^[A-Za-z0-9_-]+$/;
export const SESSION_MAX_AGE_SECONDS = 604_800;

export function isPlausibleJwt(token: string): boolean {
  if (token.length < 20 || token.length > 4096) {
    return false;
  }
  const parts = token.split(".");
  return parts.length === 3 && parts.every((part) => part.length > 0 && JWT_PART.test(part));
}

export function sessionSubjectId(token: string): number | null {
  const part = token.split(".")[1];
  if (!part) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as {
      sub?: unknown;
    };
    const raw = payload.sub;
    const id = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : Number.NaN;
    if (!Number.isSafeInteger(id) || id < 1 || (typeof raw === "string" && !/^[1-9]\d*$/.test(raw))) {
      return null;
    }
    return id;
  } catch {
    return null;
  }
}

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
    ) as { exp?: unknown; };
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

export type IssuedSession = {
  token: string;
  user: PublicUser;
};

export function readIssuedSession(data: unknown): IssuedSession | null {
  if (!isRecord(data) || typeof data.token !== "string") {
    return null;
  }
  if (!isPlausibleJwt(data.token)) {
    return null;
  }
  const user = parsePublicUser(data.user);
  if (!user || user.status !== "ACTIVE") {
    return null;
  }
  return { token: data.token, user };
}

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
