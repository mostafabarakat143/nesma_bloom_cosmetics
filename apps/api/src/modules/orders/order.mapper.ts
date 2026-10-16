import type { Order, OrderItem } from "../../generated/prisma/client.js";

export type OrderItemDto = {
  id: number;
  productId: number;
  productNameSnapshot: string;
  productSkuSnapshot: string;
  unitPriceMinor: number;
  quantity: number;
  lineTotalMinor: number;
};

export type OrderDto = {
  id: number;
  userId: number;
  status: Order["status"];
  totalMinor: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
  items: OrderItemDto[];
};

export type OrderWithItems = Order & {
  items: OrderItem[];
};

export function toOrderItemDto(item: OrderItem): OrderItemDto {
  return {
    id: item.id,
    productId: item.productId,
    productNameSnapshot: item.productNameSnapshot,
    productSkuSnapshot: item.productSkuSnapshot,
    unitPriceMinor: item.unitPriceMinor,
    quantity: item.quantity,
    lineTotalMinor: item.lineTotalMinor,
  };
}

export function toOrderDto(order: OrderWithItems): OrderDto {
  return {
    id: order.id,
    userId: order.userId,
    status: order.status,
    totalMinor: order.totalMinor,
    currency: order.currency,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    items: order.items.map(toOrderItemDto),
  };
}
