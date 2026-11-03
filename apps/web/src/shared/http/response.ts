import { createValidation } from "@/shared/validation";

import { NextResponse } from "next/server";

import { SAME_ORIGIN_HEADER, SAME_ORIGIN_VALUE } from "./request";

const defaultValidation = createValidation();

const headers = {
  "Cache-Control": "private, no-store",
  Vary: "Cookie",
};

export function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ status: "error", message }, { status, headers });
}

export function jsonSuccess(status: number, data: unknown): NextResponse {
  return NextResponse.json({ status: "success", data }, { status, headers });
}

export function untrustedResponse(request: Request): NextResponse | null {
  if (isTrustedMutation(request)) {
    return null;
  }
  return jsonError(403, defaultValidation.messages.rejected);
}

export async function readJson(request: Request): Promise<unknown | "invalid"> {
  try {
    return await request.json();
  } catch {
    return "invalid";
  }
}

export function scrubSecrets(message: string, secrets: string[]): string {
  const trimmed = message.trim().slice(0, 300);
  for (const secret of secrets) {
    if (secret.length >= 20 && trimmed.includes(secret)) {
      return defaultValidation.messages.resetInvalid;
    }
  }
  return trimmed || defaultValidation.message("requestFailed");
}

export function isTrustedMutation(request: Request): boolean {
  if (request.headers.get(SAME_ORIGIN_HEADER) !== SAME_ORIGIN_VALUE) {
    return false;
  }

  const origin = request.headers.get("origin");
  if (!origin) {
    return false;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  if (originUrl.origin === new URL(request.url).origin) {
    return true;
  }

  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return Boolean(host) && originUrl.host === host;
}
