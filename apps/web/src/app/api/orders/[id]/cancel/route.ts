import { clearSession, readSessionToken } from "@/lib/auth/cookies";
import { MESSAGES } from "@/lib/auth/credentials";
import { bearerInit, callExpress } from "@/lib/auth/express";
import { jsonError, jsonSuccess, untrustedResponse } from "@/lib/auth/http";
import { parseOrder } from "@/lib/orders/parse";
import { parsePositiveId } from "@/lib/shop-query";

export const dynamic = "force-dynamic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const rejected = untrustedResponse(request);
  if (rejected) {
    return rejected;
  }

  const { id: rawId } = await context.params;
  const id = parsePositiveId(rawId);
  if (id === null || id === "invalid") {
    return jsonError(404, "Order not found");
  }

  const token = await readSessionToken();
  if (!token) {
    const response = jsonError(401, "Authentication required");
    clearSession(response);
    return response;
  }

  const result = await callExpress(`/api/v1/orders/${id}/cancel`, bearerInit(token, "POST"));
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
  return jsonSuccess(200, { order });
}
