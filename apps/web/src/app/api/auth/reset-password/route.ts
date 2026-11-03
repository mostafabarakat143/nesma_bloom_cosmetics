import { createValidation } from "@/shared/validation";
import { isRecord } from "@/shared/lib/guards";
import { clearSession } from "@/features/auth/lib/cookies";
import { firstError, isUsableResetToken, validateNewPassword } from "@/features/auth/lib/credentials";

import {
  jsonError,
  jsonSuccess,
  readJson,
  scrubSecrets,
  untrustedResponse,
} from "@/shared/http/response";
import { authServerService } from "@/features/auth/services/auth.server";

const defaultValidation = createValidation();

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rejected = untrustedResponse(request);
  if (rejected) {
    return rejected;
  }

  const body = await readJson(request);
  if (body === "invalid") {
    return jsonError(400, defaultValidation.messages.malformed);
  }

  const token = isRecord(body) && typeof body.token === "string" ? body.token.trim() : "";
  if (!isUsableResetToken(token)) {
    return jsonError(400, defaultValidation.messages.resetInvalid);
  }

  const parsed = validateNewPassword(body);
  if (!parsed.ok) {
    return jsonError(400, firstError(parsed.errors));
  }

  const result = await authServerService.resetPassword({ token, newPassword: parsed.value });

  if (result.kind === "unreachable") {
    return jsonError(503, defaultValidation.messages.unavailable);
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
      : defaultValidation.messages.resetSuccess;

  const response = jsonSuccess(200, { message });
  clearSession(response);
  return response;
}
