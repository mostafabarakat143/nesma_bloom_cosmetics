import {
  firstError,
  MESSAGES,
  validateLogin,
} from "@/lib/auth/credentials";
import { attachSession, clearSession } from "@/lib/auth/cookies";
import { callExpress, readIssuedSession, revokeToken } from "@/lib/auth/express";
import {
  jsonError,
  jsonSuccess,
  readJson,
  untrustedResponse,
} from "@/lib/auth/http";
import { safeNextPath } from "@/lib/auth/redirect";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rejected = untrustedResponse(request);
  if (rejected) {
    return rejected;
  }

  const body = await readJson(request);
  if (body === "invalid") {
    return jsonError(400, MESSAGES.malformed);
  }

  const parsed = validateLogin(body);
  if (!parsed.ok) {
    return jsonError(400, firstError(parsed.errors));
  }

  const redirectTo = safeNextPath(
    typeof body === "object" && body && "next" in body ? body.next : undefined,
  );
  const result = await callExpress("/api/v1/auth/login", {
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

  const issued = readIssuedSession(result.data);
  if (!issued) {
    return jsonError(502, MESSAGES.unavailable);
  }

  const response = jsonSuccess(200, { redirectTo });
  if (!attachSession(response, issued.token)) {
    await revokeToken(issued.token);
    clearSession(response);
    return jsonError(401, MESSAGES.sessionEnded);
  }

  return response;
}
