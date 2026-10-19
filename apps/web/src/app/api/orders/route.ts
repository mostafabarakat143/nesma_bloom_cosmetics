import { clearSession, readSessionToken } from "@/lib/auth/cookies";
import { MESSAGES } from "@/lib/auth/credentials";
import { bearerInit, callExpress } from "@/lib/auth/express";
import { jsonError, jsonSuccess, readJson, untrustedResponse } from "@/lib/auth/http";
import { parseOrder } from "@/lib/orders/parse";
import { parseIdempotencyKey, validateOrderItems } from "@/lib/orders/payload";

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

  const key = parseIdempotencyKey(request.headers.get("idempotency-key"));
  if (!key) {
    return jsonError(400, "Idempotency-Key header is required");
  }

  const body = await readJson(request);
  if (body === "invalid") {
    return jsonError(400, MESSAGES.malformed);
  }

  const parsed = validateOrderItems(body);
  if (!parsed.ok) {
    return jsonError(400, parsed.message);
  }

  const result = await callExpress("/api/v1/orders", {
    ...bearerInit(token, "POST", {
      "content-type": "application/json",
      "idempotency-key": key,
    }),
    body: JSON.stringify({ items: parsed.items }),
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

  const order = isRecord(result.data) ? parseOrder(result.data.order) : null;
  if (!order) {
    return jsonError(502, MESSAGES.unavailable);
  }

  return jsonSuccess(result.status === 201 ? 201 : 200, {
    order,
    created: result.status === 201,
  });
}
