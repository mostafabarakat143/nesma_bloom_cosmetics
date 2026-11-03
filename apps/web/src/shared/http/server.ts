import { createValidation } from "@/shared/validation";

import { isRecord } from "@/shared/lib/guards";
import { getApiUrl } from "@/shared/config/server";
import { joinApiUrl } from "./request";
import { responseErrorMessage } from "../errors";

const defaultValidation = createValidation();

type ExpressFailure =
  | { kind: "error"; status: number; message: string; }
  | { kind: "unreachable"; };

export type ExpressResult =
  | { kind: "ok"; status: number; data: unknown; }
  | ExpressFailure;

function messageOf(body: unknown): string {
  return responseErrorMessage(body, "").trim() || defaultValidation.message("requestFailed");
}

export async function callExpress(
  path: string,
  init: RequestInit,
  timeoutMs = 8_000,
): Promise<ExpressResult> {
  let url: string;
  try {
    url = getApiUrl();
  } catch {
    return { kind: "unreachable" };
  }

  try {
    const response = await fetch(joinApiUrl(url, path), {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
    }

    if (!response.ok) {
      return {
        kind: "error",
        status: response.status,
        message: messageOf(body),
      };
    }

    if (!isRecord(body) || body.status !== "success") {
      return { kind: "error", status: 502, message: defaultValidation.messages.unavailable };
    }

    return { kind: "ok", status: response.status, data: body.data };
  } catch {
    return { kind: "unreachable" };
  }
}

export function bearerInit(
  token: string,
  method: "GET" | "POST" | "PATCH",
  extraHeaders?: Record<string, string>,
): RequestInit {
  return {
    method,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...extraHeaders,
    },
  };
}
