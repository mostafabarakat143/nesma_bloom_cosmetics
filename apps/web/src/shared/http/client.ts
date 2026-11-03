import { createValidation } from "@/shared/validation";
import { isRecord } from "@/shared/lib/guards";

import { responseErrorMessage, type RequestFailure } from "@/shared/errors";
import { getBrowserApiUrl, SAME_ORIGIN_HEADER, SAME_ORIGIN_VALUE } from "./request";

const defaultValidation = createValidation();

export type RequestResult =
  | { ok: true; status: number; data: Record<string, unknown>; }
  | RequestFailure;

async function sendRequest(path: string, init: RequestInit): Promise<RequestResult> {
  try {
    const response = await fetch(getBrowserApiUrl(path), { ...init, cache: "no-store" });
    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return { ok: false, status: response.status, message: responseErrorMessage(payload) };
    }
    const data = isRecord(payload) && isRecord(payload.data) ? payload.data : {};
    return { ok: true, status: response.status, data };
  } catch {
    return { ok: false, status: 0, message: defaultValidation.messages.unavailable };
  }
}

export async function requestFile(path: string, file: File): Promise<RequestResult> {
  try {
    const body = new FormData();
    body.append("file", file, file.name || "avatar");
    return sendRequest(path, {
      method: "POST",
      headers: {
        accept: "application/json",
        [SAME_ORIGIN_HEADER]: SAME_ORIGIN_VALUE,
      },
      body,
    });
  } catch {
    return { ok: false, status: 0, message: defaultValidation.messages.unavailable };
  }
}

export async function requestJson(
  path: string,
  body: unknown,
  method: "POST" | "PATCH" = "POST",
  extraHeaders: Record<string, string> = {},
): Promise<RequestResult> {
  try {
    return sendRequest(path, {
      method,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        [SAME_ORIGIN_HEADER]: SAME_ORIGIN_VALUE,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, message: defaultValidation.messages.unavailable };
  }
}
