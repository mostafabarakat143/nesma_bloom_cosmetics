import { createValidation } from "@/shared/validation";

import {
  isWrongCurrentPassword,
  validatePasswordChangeBody,
} from "@/features/account/lib/password-change";
import { accountServerService } from "@/features/account/services/account.server";
import { clearSession, readSessionToken } from "@/features/auth/lib/cookies";

import { jsonError, jsonSuccess, readJson, untrustedResponse } from "@/shared/http/response";

const defaultValidation = createValidation();

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rejected = untrustedResponse(request);
  if (rejected) {
    return rejected;
  }

  const token = await readSessionToken();
  if (!token) {
    const response = jsonError(401, defaultValidation.message("authenticationRequired"));
    clearSession(response);
    return response;
  }

  const body = await readJson(request);
  if (body === "invalid") {
    return jsonError(400, defaultValidation.messages.malformed);
  }

  const parsed = validatePasswordChangeBody(body);
  if (!parsed.ok) {
    return jsonError(400, parsed.message);
  }

  const result = await accountServerService.changePassword(token, parsed.value);

  if (result.kind === "unreachable") {
    return jsonError(503, defaultValidation.messages.unavailable);
  }
  if (result.kind === "error") {
    const response = jsonError(result.status, result.message);
    if (result.status === 401 && !isWrongCurrentPassword(result.message)) {
      clearSession(response);
    }
    return response;
  }

  const response = jsonSuccess(200, {
    message: defaultValidation.messages.passwordChanged,
  });
  clearSession(response);
  return response;
}
