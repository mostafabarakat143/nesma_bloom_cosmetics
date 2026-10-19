import { getCatalogProduct } from "@/lib/api/catalog";
import { jsonError, jsonSuccess } from "@/lib/auth/http";
import { MESSAGES } from "@/lib/auth/credentials";
import { parsePositiveId } from "@/lib/shop-query";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: rawId } = await context.params;
  const id = parsePositiveId(rawId);
  if (id === null || id === "invalid") {
    return jsonError(404, "Product not found");
  }

  const result = await getCatalogProduct(id);
  if (result.status === "not_found") {
    return jsonError(404, "Product not found");
  }
  if (result.status !== "ok") {
    return jsonError(503, MESSAGES.unavailable);
  }

  const { product } = result;
  return jsonSuccess(200, {
    product: {
      id: product.id,
      name: product.name,
      priceMinor: product.priceMinor,
      currency: product.currency,
      inStock: product.inStock,
      stockQty: product.stockQty,
      imageUrl: product.image?.url ?? null,
      imageAlt: product.image?.altText?.trim() || product.name,
    },
  });
}
