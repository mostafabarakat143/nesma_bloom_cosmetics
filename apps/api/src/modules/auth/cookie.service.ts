import type { CookieOptions, Response } from "express";

import {
  ACCESS_COOKIE,
  CSRF_COOKIE,
  REFRESH_COOKIE,
} from "../../common/constants/cookies.js";
import type { Env } from "../../config/env.js";

function baseCookieOptions(env: Env): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
  };
}

export function setAuthCookies(
  res: Response,
  env: Env,
  tokens: {
    accessToken: string;
    refreshToken: string;
    csrfToken: string;
  },
): void {
  const base = baseCookieOptions(env);

  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: env.JWT_ACCESS_TTL_SECONDS * 1000,
  });

  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...base,
    path: "/api/v1/auth",
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });

  // Readable by JS so the SPA can mirror it into X-CSRF-Token on mutations.
  res.cookie(CSRF_COOKIE, tokens.csrfToken, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: env.REFRESH_TOKEN_TTL_SECONDS * 1000,
  });
}

export function clearAuthCookies(res: Response, env: Env): void {
  const base = baseCookieOptions(env);

  res.clearCookie(ACCESS_COOKIE, { ...base, path: "/" });
  res.clearCookie(REFRESH_COOKIE, { ...base, path: "/api/v1/auth" });
  res.clearCookie(CSRF_COOKIE, {
    httpOnly: false,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
  });
}
