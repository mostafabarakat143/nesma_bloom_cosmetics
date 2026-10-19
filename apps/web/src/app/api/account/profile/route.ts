import { clearSession, readSessionToken } from "@/lib/auth/cookies";
import { bearerInit, callExpress } from "@/lib/auth/express";
import { MESSAGES } from "@/lib/auth/credentials";
import {
  jsonError,
  jsonSuccess,
  readJson,
  untrustedResponse,
} from "@/lib/auth/http";
import { parseAccountProfile } from "@/lib/auth/profile-parse";
import {
  profileUpdateError,
  validateProfileUpdate,
} from "@/lib/auth/profile-update";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function PATCH(request: Request) {
  const rejected = untrustedResponse(request);
  if (rejected) {
    return rejected;
  }

  const token = await readSessionToken();
  if (!token) {
    const response = jsonError(401, "Authentication required");
    clearSession(response);
    return response;
  }

  const body = await readJson(request);
  if (body === "invalid") {
    return jsonError(400, MESSAGES.malformed);
  }

  const parsed = validateProfileUpdate(body);
  if (!parsed.ok) {
    return jsonError(400, profileUpdateError(parsed.errors));
  }

  const result = await callExpress("/api/v1/users/me/profile", {
    ...bearerInit(token, "PATCH"),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(parsed.value),
  });

  if (result.kind === "unreachable") {
    return jsonError(503, MESSAGES.unavailable);
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
    return jsonError(502, MESSAGES.unavailable);
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
