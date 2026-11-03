import { createValidation } from "@/shared/validation";

import { jsonError, jsonSuccess } from "@/shared/http/response";
import { parsePositiveId } from "@/features/catalog/lib/shop-query";
import { getCatalogProduct } from "@/features/catalog/services/catalog.server";

const defaultValidation = createValidation();

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; }>; },
) {
  const { id: rawId } = await context.params;
  const id = parsePositiveId(rawId);
  if (id === null || id === "invalid") {
    return jsonError(404, defaultValidation.message("productNotFound"));
  }

  const result = await getCatalogProduct(id);
  if (result.status === "not_found") {
    return jsonError(404, defaultValidation.message("productNotFound"));
  }
  if (result.status !== "ok") {
    return jsonError(503, defaultValidation.messages.unavailable);
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
