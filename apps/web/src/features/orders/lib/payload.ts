import { createValidation } from "@/shared/validation";

const defaultValidation = createValidation();

export const MAX_ORDER_LINES = defaultValidation.limits.orderLines;
export const MAX_ORDER_QUANTITY = defaultValidation.limits.orderQuantity;
export type OrderLine = {
  productId: number;
  quantity: number;
};

export function canonicalOrderItems(items: OrderLine[]): string {
  const canonical = [...items]
    .map((item) => ({ productId: item.productId, quantity: item.quantity }))
    .sort((left, right) => left.productId - right.productId);
  return JSON.stringify(canonical);
}

export function parseIdempotencyKey(raw: string | null): string | null {
  const parsed = defaultValidation.orders.idempotencyKey().safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function validateOrderItems(body: unknown) {
  const parsed = defaultValidation.orders.create().safeParse(body);
  return parsed.success ? { ok: true as const, items: parsed.data.items }
    : { ok: false as const, message: parsed.error.issues[0]?.message ?? defaultValidation.message("orderItemsRequired") };
}

export function maxPurchasableQuantity(product: {
  inStock: boolean;
  stockQty: number | null;
}): number {
  if (!product.inStock) {
    return 0;
  }
  if (product.stockQty === null) {
    return MAX_ORDER_QUANTITY;
  }
  return Math.min(MAX_ORDER_QUANTITY, product.stockQty);
}
