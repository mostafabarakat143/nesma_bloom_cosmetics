import { requestJson } from "@/shared/http/client";
import type { OrderLine } from "../lib/payload";

export type CreateOrderRequest = { items: OrderLine[]; key: string; };

export const ordersService = {
  create: ({ items, key }: CreateOrderRequest) => requestJson("orders", { items }, "POST", { "idempotency-key": key }),
  cancel: (orderId: number) => requestJson(`orders/${orderId}/cancel`, {}),
};

export function orderWhatsappUrl(orderId: number) {
  const number = process.env.NEXT_PUBLIC_ORDER_WHATSAPP_NUMBER?.trim();
  if (!number) throw new Error("NEXT_PUBLIC_ORDER_WHATSAPP_NUMBER is required.");
  const text = `تاكيد الاوردر رقم ${orderId}`;
  return `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
}
