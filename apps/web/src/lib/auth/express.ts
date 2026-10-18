import { getApiUrl } from "@/lib/env";

import {
  MESSAGES,
  parsePublicUser,
  type PublicUser,
} from "./credentials";
import { isPlausibleJwt } from "./jwt";

type ExpressFailure =
  | { kind: "error"; status: number; message: string }
  | { kind: "unreachable" };

export type ExpressResult =
  | { kind: "ok"; status: number; data: unknown }
  | ExpressFailure;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function messageOf(body: unknown): string {
  if (isRecord(body) && typeof body.message === "string" && body.message.trim()) {
    return body.message.trim();
  }
  return "Request failed.";
}

/**
 * Server-side Express call. The Authorization value, when present, comes from
 * the HttpOnly session cookie. Callers must not pass a browser header through.
 */
export async function callExpress(
  path: string,
  init: RequestInit,
): Promise<ExpressResult> {
  let url: string;
  try {
    url = getApiUrl();
  } catch {
    return { kind: "unreachable" };
  }

  try {
    const response = await fetch(`${url}${path}`, {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
    }

    if (!response.ok) {
      return {
        kind: "error",
        status: response.status,
        message: messageOf(body),
      };
    }

    if (!isRecord(body) || body.status !== "success") {
      return { kind: "error", status: 502, message: MESSAGES.unavailable };
    }

    return { kind: "ok", status: response.status, data: body.data };
  } catch {
    return { kind: "unreachable" };
  }
}

export function bearerInit(
  token: string,
  method: "GET" | "POST" | "PATCH",
  extraHeaders?: Record<string, string>,
): RequestInit {
  return {
    method,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...extraHeaders,
    },
  };
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

export async function revokeToken(token: string): Promise<ExpressResult> {
  return callExpress("/api/v1/auth/logout", bearerInit(token, "POST"));
}
