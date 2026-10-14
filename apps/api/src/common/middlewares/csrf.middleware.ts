import type { NextFunction, Request, Response } from "express";

import { CSRF_COOKIE, CSRF_HEADER } from "../constants/cookies.js";
import { AppError } from "../errors/app-error.js";
import { getTrustedOrigins, type Env } from "../../config/env.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF defense for cookie-authenticated mutating requests:
 * 1) Trusted Origin (or Referer fallback) must match CORS allowlist.
 * 2) Double-submit: X-CSRF-Token header must equal nb_csrf cookie.
 *
 * Does not rely on SameSite alone. Uses the browser-sent Origin/Referer
 * (not Host/X-Forwarded-Host) so reverse proxies cannot forge trust.
 */
export function createCsrfMiddleware(env: Env) {
  const trustedOrigins = new Set(getTrustedOrigins(env));

  return function csrfMiddleware(
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    // Auth bootstrap endpoints establish cookies; still require Origin when configured.
    const origin = req.get("origin");
    const referer = req.get("referer");

    if (trustedOrigins.size > 0) {
      const requestOrigin = origin ?? extractOrigin(referer);
      if (!requestOrigin || !trustedOrigins.has(requestOrigin)) {
        next(AppError.forbidden("Invalid request origin"));
        return;
      }
    } else if (env.NODE_ENV === "production") {
      next(
        AppError.forbidden(
          "CORS_ORIGIN must be configured for cookie-authenticated mutations",
        ),
      );
      return;
    }

    // Double-submit cookie pattern for any request that already has a CSRF cookie
    // (post-login). Register/login may not have it yet.
    const csrfCookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const csrfHeader = req.get(CSRF_HEADER);

    if (csrfCookie) {
      if (!csrfHeader || csrfHeader !== csrfCookie) {
        next(AppError.forbidden("Invalid CSRF token"));
        return;
      }
    }

    next();
  };
}

function extractOrigin(referer: string | undefined): string | null {
  if (!referer) {
    return null;
  }

  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return null;
  }
}
