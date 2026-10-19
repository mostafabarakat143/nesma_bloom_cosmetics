import { MESSAGES } from "@/lib/auth/credentials";
import { clearSession, readSessionToken } from "@/lib/auth/cookies";
import { revokeToken } from "@/lib/auth/express";
import { jsonError, jsonSuccess, untrustedResponse } from "@/lib/auth/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rejected = untrustedResponse(request);
  if (rejected) {
    return rejected;
  }

  const token = await readSessionToken();
  if (!token) {
    const response = jsonSuccess(200, {
      revoked: false,
      message: MESSAGES.sessionEnded,
    });
    clearSession(response);
    return response;
  }

  const result = await revokeToken(token);
  if (result.kind === "unreachable") {
    const response = jsonError(503, MESSAGES.revokeUnconfirmed);
    clearSession(response);
    return response;
  }

  if (result.kind === "error" && result.status === 401) {
    const response = jsonSuccess(200, {
      revoked: false,
      message: MESSAGES.sessionEnded,
    });
    clearSession(response);
    return response;
  }

  if (result.kind === "error") {
    return jsonError(result.status, result.message);
  }

  const response = jsonSuccess(200, {
    revoked: true,
    message: MESSAGES.loggedOut,
  });
  clearSession(response);
  return response;
}
