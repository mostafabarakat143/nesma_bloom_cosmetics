import { createValidation } from "@/shared/validation";

import { isRecord } from "@/shared/lib/guards";
import { AVATAR_FILE_MESSAGES, avatarFileError } from "@/features/account/lib/avatar-file";
import { parseAccountProfile } from "@/features/account/lib/profile-parse";
import { accountServerService } from "@/features/account/services/account.server";
import { clearSession, readSessionToken } from "@/features/auth/lib/cookies";

import { jsonError, jsonSuccess, untrustedResponse } from "@/shared/http/response";

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

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return jsonError(400, AVATAR_FILE_MESSAGES.missing);
  }

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return jsonError(400, AVATAR_FILE_MESSAGES.missing);
  }

  const files = incoming.getAll("file").filter((part) => part instanceof File);
  if (files.length !== 1) {
    return jsonError(400, AVATAR_FILE_MESSAGES.missing);
  }
  const file = files[0];
  if (!file) {
    return jsonError(400, AVATAR_FILE_MESSAGES.missing);
  }
  const problem = avatarFileError(file);
  if (problem) {
    return jsonError(400, problem);
  }

  const outbound = new FormData();
  outbound.append("file", file, file.name || "avatar");

  const result = await accountServerService.uploadAvatar(token, outbound);

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
