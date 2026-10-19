import { cache } from "react";

import { readSessionToken } from "@/lib/auth/cookies";
import { bearerInit, callExpress } from "@/lib/auth/express";

import { parseOrder, parseOrderPage, type CustomerOrder, type OrderPage } from "./parse";
import { ORDER_PAGE_SIZE, type OrderListQuery } from "./query";

export type OrderListResult =
  | { status: "ok"; page: OrderPage }
  | { status: "unauthorized" }
  | { status: "unavailable" };

export type OrderResult =
  | { status: "ok"; order: CustomerOrder }
  | { status: "not_found" }
  | { status: "unauthorized" }
  | { status: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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
  const result = await callExpress(`/api/v1/orders/my?${params.toString()}`, bearerInit(token, "GET"));
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

  const result = await callExpress(`/api/v1/orders/${id}`, bearerInit(token, "GET"));
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
