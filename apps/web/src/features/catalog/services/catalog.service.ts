import { isRecord } from "@/shared/lib/guards";
import type { ReadyProduct, ProductState } from "../types";
import { getBrowserApiUrl } from "@/shared/http/request";

export const catalogKeys = {
  all: ["catalog"] as const,
  checkoutProduct: (userId: number, productId: number) => ["catalog", "checkout", userId, productId] as const,
};

function parseReadyProduct(value: unknown): ReadyProduct | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    typeof value.id !== "number" ||
    typeof value.name !== "string" ||
    value.name.trim() === "" ||
    typeof value.priceMinor !== "number" ||
    !Number.isInteger(value.priceMinor) ||
    value.priceMinor < 0 ||
    typeof value.currency !== "string" ||
    value.currency.trim() === "" ||
    typeof value.inStock !== "boolean"
  ) {
    return null;
  }
  let stockQty: number | null = null;
  if (value.stockQty !== null && value.stockQty !== undefined) {
    if (typeof value.stockQty !== "number" || !Number.isInteger(value.stockQty) || value.stockQty < 0) {
      return null;
    }
    stockQty = value.stockQty;
  }
  return {
    id: value.id,
    name: value.name,
    priceMinor: value.priceMinor,
    currency: value.currency,
    inStock: value.inStock,
    stockQty,
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : null,
    imageAlt: typeof value.imageAlt === "string" && value.imageAlt.trim() ? value.imageAlt : value.name,
  };
}

export async function loadProduct(id: number): Promise<ProductState> {
  try {
    const response = await fetch(getBrowserApiUrl(`catalog/products/${id}`), {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (response.status === 404) {
      return { state: "missing" };
    }
    if (!response.ok) {
      return { state: "unavailable" };
    }
    const payload = (await response.json()) as unknown;
    const product = isRecord(payload) && isRecord(payload.data) ? parseReadyProduct(payload.data.product) : null;
    return product ? { state: "ready", product } : { state: "unavailable" };
  } catch {
    return { state: "unavailable" };
  }
}
