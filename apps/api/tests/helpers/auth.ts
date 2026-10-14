import type { Response } from "supertest";

import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  CSRF_HEADER,
  REFRESH_COOKIE,
} from "../../src/common/constants/cookies.js";

export const TEST_ORIGIN = "http://localhost:3000";

export function parseCookies(response: Response): Record<string, string> {
  const raw = response.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookies: Record<string, string> = {};

  for (const entry of list) {
    const [pair] = entry.split(";");
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name = pair.slice(0, idx);
    const value = pair.slice(idx + 1);
    cookies[name] = decodeURIComponent(value);
  }

  return cookies;
}

export function cookieHeader(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

export function authHeaders(cookies: Record<string, string>) {
  const headers: Record<string, string> = {
    Origin: TEST_ORIGIN,
    Cookie: cookieHeader(cookies),
  };

  if (cookies[CSRF_COOKIE]) {
    headers[CSRF_HEADER] = cookies[CSRF_COOKIE];
  }

  return headers;
}

export function mergeCookies(
  current: Record<string, string>,
  response: Response,
): Record<string, string> {
  return { ...current, ...parseCookies(response) };
}

export { ACCESS_COOKIE, CSRF_COOKIE, REFRESH_COOKIE, CSRF_HEADER };
