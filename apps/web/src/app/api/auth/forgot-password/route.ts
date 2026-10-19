import {
  firstError,
  MESSAGES,
  validateForgot,
} from "@/lib/auth/credentials";
import { callExpress } from "@/lib/auth/express";
import {
  jsonError,
  jsonSuccess,
  readJson,
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

  const parsed = validateForgot(body);
  if (!parsed.ok) {
    return jsonError(400, firstError(parsed.errors));
  }

  const result = await callExpress("/api/v1/auth/forgot-password", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(parsed.value),
  });

  if (result.kind === "unreachable") {
    return jsonError(503, MESSAGES.unavailable);
  }
  if (result.kind === "error") {
    return jsonError(result.status, result.message);
  }

  const raw =
    isRecord(result.data) && typeof result.data.message === "string"
      ? result.data.message
      : MESSAGES.forgot;
  const message =
    raw.includes("token=") || raw.includes("reset-password?")
      ? MESSAGES.forgot
      : raw;

  return jsonSuccess(200, { message });
}
