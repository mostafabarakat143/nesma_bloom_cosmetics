import { createValidation } from "@/shared/validation";

import { isRecord } from "@/shared/lib/guards";
import { clearSession, readSessionToken } from "@/features/auth/lib/cookies";

import { jsonError, jsonSuccess, readJson, untrustedResponse } from "@/shared/http/response";
import { parseOrder } from "@/features/orders/lib/parse";
import { parseIdempotencyKey, validateOrderItems } from "@/features/orders/lib/payload";
import { ordersServerService } from "@/features/orders/services/orders.server";

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

  const key = parseIdempotencyKey(request.headers.get("idempotency-key"));
  if (!key) {
    return jsonError(400, defaultValidation.message("idempotencyRequired"));
  }

  const body = await readJson(request);
  if (body === "invalid") {
    return jsonError(400, defaultValidation.messages.malformed);
  }

  const parsed = validateOrderItems(body);
  if (!parsed.ok) {
    return jsonError(400, parsed.message);
  }

  const result = await ordersServerService.create(token, key, parsed.items);

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

  const order = isRecord(result.data) ? parseOrder(result.data.order) : null;
  if (!order) {
    return jsonError(502, defaultValidation.messages.unavailable);
  }

  return jsonSuccess(result.status === 201 ? 201 : 200, {
    order,
    created: result.status === 201,
  });
}
