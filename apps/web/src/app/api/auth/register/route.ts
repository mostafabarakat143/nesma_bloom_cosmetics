import { createValidation } from "@/shared/validation";
import { attachSession, clearSession } from "@/features/auth/lib/cookies";
import { firstError, validateRegister } from "@/features/auth/lib/credentials";

import {
  jsonError,
  jsonSuccess,
  readJson,
  untrustedResponse,
} from "@/shared/http/response";
import { safeNextPath, readIssuedSession } from "@/features/auth/lib/session";
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

  const parsed = validateRegister(body);
  if (!parsed.ok) {
    return jsonError(400, firstError(parsed.errors));
  }

  const redirectTo = safeNextPath(
    typeof body === "object" && body && "next" in body ? body.next : undefined,
  );
  const result = await authServerService.register(parsed.value);

  if (result.kind === "unreachable") {
    return jsonError(503, defaultValidation.messages.unavailable);
  }
  if (result.kind === "error") {
    return jsonError(result.status, result.message);
  }

  const issued = readIssuedSession(result.data);
  if (!issued || issued.user.role !== "CUSTOMER") {
    if (issued) {
      await authServerService.revokeToken(issued.token);
    }
    return jsonError(502, defaultValidation.messages.unavailable);
  }

  const response = jsonSuccess(201, { redirectTo });
  if (!attachSession(response, issued.token)) {
    await authServerService.revokeToken(issued.token);
    clearSession(response);
    return jsonError(401, defaultValidation.messages.sessionEnded);
  }

  return response;
}
