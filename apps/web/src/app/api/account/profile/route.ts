import { createValidation } from "@/shared/validation";

import { isRecord } from "@/shared/lib/guards";
import { parseAccountProfile } from "@/features/account/lib/profile-parse";
import {
  profileUpdateError,
  validateProfileUpdate,
} from "@/features/account/lib/profile-update";
import { accountServerService } from "@/features/account/services/account.server";
import { clearSession, readSessionToken } from "@/features/auth/lib/cookies";

import {
  jsonError,
  jsonSuccess,
  readJson,
  untrustedResponse,
} from "@/shared/http/response";

const defaultValidation = createValidation();

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
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

  const parsed = validateProfileUpdate(body);
  if (!parsed.ok) {
    return jsonError(400, profileUpdateError(parsed.errors));
  }

  const result = await accountServerService.updateProfile(token, parsed.value);

  if (result.kind === "unreachable") {
    return jsonError(503, defaultValidation.messages.unavailable);
  }
  if (result.kind === "error") {
    const response = jsonError(result.status, result.message);
    if (result.status === 401) {
      clearSession(response);
    }
    return response;
  }

  const profile = isRecord(result.data) ? parseAccountProfile(result.data.profile) : null;
  if (!profile) {
    return jsonError(502, defaultValidation.messages.unavailable);
  }

  return jsonSuccess(200, {
    profile: {
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      phone: profile.phone,
      avatarUrl: profile.avatarUrl,
    },
  });
}
