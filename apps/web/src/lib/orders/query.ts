import { firstString, type RawSearchParams } from "@/lib/shop-query";
import { ORDER_STATUSES, type OrderStatus } from "./parse";
export const ORDER_PAGE_SIZE = 20;

export type OrderListQuery = {
  page: number;
  status: OrderStatus | "ALL";
};

const FILTERS = ["ALL", ...ORDER_STATUSES] as const;

export function parseOrderListQuery(params: RawSearchParams): OrderListQuery {
  const statusRaw = firstString(params.status).trim().toUpperCase();
  const status = FILTERS.includes(statusRaw as (typeof FILTERS)[number])
    ? (statusRaw as OrderListQuery["status"])
    : "ALL";

  const pageRaw = firstString(params.page).trim();
  let page = 1;
  if (/^[1-9]\d*$/.test(pageRaw)) {
    const value = Number(pageRaw);
    if (value <= 10_000) {
      page = value;
    }
  }

  return { page, status };
}

export function ordersHref(query: OrderListQuery, page = query.page): string {
  const params = new URLSearchParams();
  if (query.status !== "ALL") {
    params.set("status", query.status);
  }
  if (page > 1) {
    params.set("page", String(page));
  }
  const text = params.toString();
  return text ? `/account/orders?${text}` : "/account/orders";
}
