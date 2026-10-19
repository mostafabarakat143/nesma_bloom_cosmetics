import { clearSession, readSessionToken } from "@/lib/auth/cookies";
import { callExpress } from "@/lib/auth/express";
import { AVATAR_FILE_MESSAGES, avatarFileError } from "@/lib/auth/avatar-file";
import { MESSAGES } from "@/lib/auth/credentials";
import { jsonError, jsonSuccess, untrustedResponse } from "@/lib/auth/http";
import { parseAccountProfile } from "@/lib/auth/profile-parse";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(request: Request) {
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

  const result = await callExpress(
    "/api/v1/users/me/avatar",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${token}`,
      },
      body: outbound,
    },
    30_000,
  );

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
