import { createValidation } from "@/shared/validation";
import { isRecord } from "@/shared/lib/guards";
import { firstError, validateForgot } from "@/features/auth/lib/credentials";

import {
  jsonError,
  jsonSuccess,
  readJson,
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

  const parsed = validateForgot(body);
  if (!parsed.ok) {
    return jsonError(400, firstError(parsed.errors));
  }

  const result = await authServerService.forgotPassword(parsed.value);

  if (result.kind === "unreachable") {
    return jsonError(503, defaultValidation.messages.unavailable);
  }
  if (result.kind === "error") {
    return jsonError(result.status, result.message);
  }

  const raw =
    isRecord(result.data) && typeof result.data.message === "string"
      ? result.data.message
      : defaultValidation.messages.forgot;
  const message =
    raw.includes("token=") || raw.includes("reset-password?")
      ? defaultValidation.messages.forgot
      : raw;

  return jsonSuccess(200, { message });
}
