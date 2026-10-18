import { NextResponse } from "next/server";

import { MESSAGES } from "./credentials";
import { isTrustedMutation } from "./origin";

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
  return jsonError(403, MESSAGES.rejected);
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
      return MESSAGES.resetInvalid;
    }
  }
  return trimmed || "Request failed.";
}
