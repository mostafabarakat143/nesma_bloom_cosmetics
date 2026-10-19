import {
  firstError,
  isUsableResetToken,
  MESSAGES,
  validateNewPassword,
} from "@/lib/auth/credentials";
import { clearSession } from "@/lib/auth/cookies";
import { callExpress } from "@/lib/auth/express";
import {
  jsonError,
  jsonSuccess,
  readJson,
  scrubSecrets,
  untrustedResponse,
} from "@/lib/auth/http";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
  const rejected = untrustedResponse(request);
  if (rejected) {
    return rejected;
  }

  const body = await readJson(request);
  if (body === "invalid") {
    return jsonError(400, MESSAGES.malformed);
  }

  const token = isRecord(body) && typeof body.token === "string" ? body.token.trim() : "";
  if (!isUsableResetToken(token)) {
    return jsonError(400, MESSAGES.resetInvalid);
  }

  const parsed = validateNewPassword(body);
  if (!parsed.ok) {
    return jsonError(400, firstError(parsed.errors));
  }

  const result = await callExpress("/api/v1/auth/reset-password", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({ token, newPassword: parsed.value }),
  });

  if (result.kind === "unreachable") {
    return jsonError(503, MESSAGES.unavailable);
  }
  if (result.kind === "error") {
    return jsonError(
      result.status,
      scrubSecrets(result.message, [token, parsed.value]),
    );
  }

  const message =
    isRecord(result.data) && typeof result.data.message === "string"
      ? scrubSecrets(result.data.message, [token, parsed.value])
      : MESSAGES.resetSuccess;

  const response = jsonSuccess(200, { message });
  clearSession(response);
  return response;
}
