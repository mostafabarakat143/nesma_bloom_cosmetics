import { clearSession, readSessionToken } from "@/lib/auth/cookies";
import { MESSAGES } from "@/lib/auth/credentials";
import { bearerInit, callExpress } from "@/lib/auth/express";
import { jsonError, jsonSuccess, readJson, untrustedResponse } from "@/lib/auth/http";
import {
  isWrongCurrentPassword,
  validatePasswordChangeBody,
} from "@/lib/auth/password-change";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rejected = untrustedResponse(request);
  if (rejected) {
    return rejected;
  }

  const token = await readSessionToken();
  if (!token) {
    const response = jsonError(401, "Authentication required");
    clearSession(response);
    return response;
  }

  const body = await readJson(request);
  if (body === "invalid") {
    return jsonError(400, MESSAGES.malformed);
  }

  const parsed = validatePasswordChangeBody(body);
  if (!parsed.ok) {
    return jsonError(400, parsed.message);
  }

  const result = await callExpress("/api/v1/auth/change-password", {
    ...bearerInit(token, "POST", { "content-type": "application/json" }),
    body: JSON.stringify(parsed.value),
  });

  if (result.kind === "unreachable") {
    return jsonError(503, MESSAGES.unavailable);
  }
  if (result.kind === "error") {
    const response = jsonError(result.status, result.message);
    if (result.status === 401 && !isWrongCurrentPassword(result.message)) {
      clearSession(response);
    }
    return response;
  }

  const response = jsonSuccess(200, {
    message: MESSAGES.passwordChanged,
  });
  clearSession(response);
  return response;
}
