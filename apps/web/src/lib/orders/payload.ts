export const MAX_ORDER_LINES = 50;
export const MAX_ORDER_QUANTITY = 100;
export type OrderLine = {
  productId: number;
  quantity: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function canonicalOrderItems(items: OrderLine[]): string {
  const canonical = [...items]
    .map((item) => ({ productId: item.productId, quantity: item.quantity }))
    .sort((left, right) => left.productId - right.productId);
  return JSON.stringify(canonical);
}

export function parseIdempotencyKey(raw: string | null): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  const key = raw.trim();
  if (key.length < 1 || key.length > 128 || !/^[\x21-\x7E]+$/.test(key)) {
    return null;
  }
  return key;
}

export function validateOrderItems(
  body: unknown,
): { ok: true; items: OrderLine[] } | { ok: false; message: string } {
  if (!isRecord(body) || Object.keys(body).some((key) => key !== "items")) {
    return { ok: false, message: "Only order items can be submitted." };
  }
  if (!Array.isArray(body.items)) {
    return { ok: false, message: "Items are required." };
  }
  if (body.items.length < 1) {
    return { ok: false, message: "Order must include at least one item." };
  }
  if (body.items.length > MAX_ORDER_LINES) {
    return { ok: false, message: "Order may include at most 50 distinct products." };
  }

  const items: OrderLine[] = [];
  const seen = new Set<number>();
  for (const entry of body.items) {
    if (!isRecord(entry) || Object.keys(entry).some((key) => key !== "productId" && key !== "quantity")) {
      return { ok: false, message: "Only a product and quantity can be submitted." };
    }
    const { productId, quantity } = entry;
    if (typeof productId !== "number" || !Number.isInteger(productId)) {
      return { ok: false, message: "Product ID must be a whole number." };
    }
    if (productId < 1 || productId > 2_147_483_647) {
      return { ok: false, message: "Product ID must be a positive integer." };
    }
    if (typeof quantity !== "number" || !Number.isInteger(quantity)) {
      return { ok: false, message: "Quantity must be a whole number." };
    }
    if (quantity < 1) {
      return { ok: false, message: "Quantity must be at least 1." };
    }
    if (quantity > MAX_ORDER_QUANTITY) {
      return { ok: false, message: "Quantity may be at most 100." };
    }
    if (seen.has(productId)) {
      return { ok: false, message: "Duplicate product IDs are not allowed." };
    }
    seen.add(productId);
    items.push({ productId, quantity });
  }

  items.sort((left, right) => left.productId - right.productId);
  return { ok: true, items };
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
