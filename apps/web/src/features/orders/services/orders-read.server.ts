import { isRecord } from "@/shared/lib/guards";
import { cache } from "react";

import { readSessionToken } from "@/features/auth/lib/cookies";
import { bearerInit, callExpress } from "@/shared/http/server";

import { parseOrder, parseOrderPage, type CustomerOrder, type OrderPage } from "@/features/orders/lib/parse";
import { ORDER_PAGE_SIZE, type OrderListQuery } from "@/features/orders/lib/query";

export type OrderListResult =
  | { status: "ok"; page: OrderPage; }
  | { status: "unauthorized"; }
  | { status: "unavailable"; };

export type OrderResult =
  | { status: "ok"; order: CustomerOrder; }
  | { status: "not_found"; }
  | { status: "unauthorized"; }
  | { status: "unavailable"; };

export async function loadMyOrders(query: OrderListQuery): Promise<OrderListResult> {
  const token = await readSessionToken();
  if (!token) {
    return { status: "unauthorized" };
  }

  const params = new URLSearchParams({
    page: String(query.page),
    pageSize: String(ORDER_PAGE_SIZE),
    status: query.status,
    sortOrder: "desc",
  });
  const result = await callExpress(`orders/my?${params.toString()}`, bearerInit(token, "GET"));
  if (result.kind === "unreachable") {
    return { status: "unavailable" };
  }
  if (result.kind === "error") {
    return result.status === 401 ? { status: "unauthorized" } : { status: "unavailable" };
  }

  const page = parseOrderPage(result.data);
  if (!page) {
    return { status: "unavailable" };
  }
  return { status: "ok", page };
}

export const loadOrder = cache(async function loadOrder(id: number): Promise<OrderResult> {
  const token = await readSessionToken();
  if (!token) {
    return { status: "unauthorized" };
  }

  const result = await callExpress(`orders/${id}`, bearerInit(token, "GET"));
  if (result.kind === "unreachable") {
    return { status: "unavailable" };
  }
  if (result.kind === "error") {
    if (result.status === 401) {
      return { status: "unauthorized" };
    }
    if (result.status === 404) {
      return { status: "not_found" };
    }
    return { status: "unavailable" };
  }

  const order = isRecord(result.data) ? parseOrder(result.data.order) : null;
  if (!order) {
    return { status: "unavailable" };
  }
  return { status: "ok", order };
});
