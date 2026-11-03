import { createValidation } from "@/shared/validation";

import { isRecord } from "@/shared/lib/guards";
import { clearSession, readSessionToken } from "@/features/auth/lib/cookies";

import { jsonError, jsonSuccess, untrustedResponse } from "@/shared/http/response";
import { parsePositiveId } from "@/features/catalog/lib/shop-query";
import { parseOrder } from "@/features/orders/lib/parse";
import { ordersServerService } from "@/features/orders/services/orders.server";

const defaultValidation = createValidation();

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; }>; },
) {
  const rejected = untrustedResponse(request);
  if (rejected) {
    return rejected;
  }

  const { id: rawId } = await context.params;
  const id = parsePositiveId(rawId);
  if (id === null || id === "invalid") {
    return jsonError(404, defaultValidation.message("orderNotFound"));
  }

  const token = await readSessionToken();
  if (!token) {
    const response = jsonError(401, defaultValidation.message("authenticationRequired"));
    clearSession(response);
    return response;
  }

  const result = await ordersServerService.cancel(token, id);
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
  return jsonSuccess(200, { order });
}
