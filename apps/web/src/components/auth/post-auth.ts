import { MESSAGES } from "@/lib/auth/credentials";
import { SAME_ORIGIN_HEADER, SAME_ORIGIN_VALUE } from "@/lib/auth/origin";

type AuthResult =
  | { ok: true; status: number; data: Record<string, unknown> }
  | { ok: false; status: number; message: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function postAuthFile(path: string, file: File): Promise<AuthResult> {
  const body = new FormData();
  body.append("file", file, file.name || "avatar");
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        accept: "application/json",
        [SAME_ORIGIN_HEADER]: SAME_ORIGIN_VALUE,
      },
      body,
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const message =
        isRecord(payload) && typeof payload.message === "string"
          ? payload.message
          : MESSAGES.unavailable;
      return { ok: false, status: response.status, message };
    }
    const data =
      isRecord(payload) && isRecord(payload.data) ? payload.data : {};
    return { ok: true, status: response.status, data };
  } catch {
    return { ok: false, status: 0, message: MESSAGES.unavailable };
  }
}

export async function postAuth(
  path: string,
  body: unknown,
  method: "POST" | "PATCH" = "POST",
  extraHeaders: Record<string, string> = {},
): Promise<AuthResult> {
  try {
    const response = await fetch(path, {
      method,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        [SAME_ORIGIN_HEADER]: SAME_ORIGIN_VALUE,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = (await response.json().catch(() => null)) as unknown;
    if (!response.ok) {
      const message =
        isRecord(payload) && typeof payload.message === "string"
          ? payload.message
          : MESSAGES.unavailable;
      return { ok: false, status: response.status, message };
    }
    const data =
      isRecord(payload) && isRecord(payload.data) ? payload.data : {};
    return { ok: true, status: response.status, data };
  } catch {
    return { ok: false, status: 0, message: MESSAGES.unavailable };
  }
}
