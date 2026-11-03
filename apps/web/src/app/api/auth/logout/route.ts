import { createValidation } from "@/shared/validation";
import { clearSession, readSessionToken } from "@/features/auth/lib/cookies";

import { jsonError, jsonSuccess, untrustedResponse } from "@/shared/http/response";
import { authServerService } from "@/features/auth/services/auth.server";

const defaultValidation = createValidation();

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
      message: defaultValidation.messages.sessionEnded,
    });
    clearSession(response);
    return response;
  }

  const result = await authServerService.revokeToken(token);
  if (result.kind === "unreachable") {
    const response = jsonError(503, defaultValidation.messages.revokeUnconfirmed);
    clearSession(response);
    return response;
  }

  if (result.kind === "error" && result.status === 401) {
    const response = jsonSuccess(200, {
      revoked: false,
      message: defaultValidation.messages.sessionEnded,
    });
    clearSession(response);
    return response;
  }

  if (result.kind === "error") {
    return jsonError(result.status, result.message);
  }

  const response = jsonSuccess(200, {
    revoked: true,
    message: defaultValidation.messages.loggedOut,
  });
  clearSession(response);
  return response;
}
