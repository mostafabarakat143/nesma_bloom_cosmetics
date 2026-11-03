"use client";

import { ErrorMessage } from "@/components/ui/error-message";

import { useCheckout } from "@/features/orders/hooks/use-checkout";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/features/catalog/components/empty-state";
import { ProductImage } from "@/features/catalog/components/product-image";
import type { ProductState } from "@/features/catalog/types";
import {
  clearVisibleDraft,
  removeDraftLine,
  updateDraftQuantity
} from "@/features/orders/lib/order-draft";
import { type OrderStatus } from "@/features/orders/lib/parse";
import { maxPurchasableQuantity } from "@/features/orders/lib/payload";
import { formatMinorPrice } from "@/lib/money";
import { useTranslations } from "next-intl";

export function CheckoutView({
  userId,
  role,
}: {
  userId: number;
  role: "CUSTOMER" | "ADMIN";
}) {
  const { t, snapshot, products, error, setError, inFlight, placeOrder } = useCheckout({ userId, role });

  if (!snapshot.ready) {
    return <p className="mt-8 text-muted">{t("loading")}</p>;
  }

  if (snapshot.confirmation && snapshot.lines.length === 0) {
    return <Confirmation confirmation={snapshot.confirmation} />;
  }

  if (snapshot.lines.length === 0) {
    return (
      <div className="mt-8">
        <EmptyState
          title={t("emptyTitle")}
          message={t("emptyMessage")}
          href="/shop"
          action={t("browse")}
        />
      </div>
    );
  }

  const estimate = estimateTotal(snapshot.lines, products);
  const blocked =
    !snapshot.pending &&
    snapshot.lines.some((line) => !canSubmitLine(line.quantity, products.get(line.productId)));

  return (
    <div className="mt-8">
      {snapshot.source === "guest" ? (
        <p className="mb-4 text-sm leading-relaxed text-muted">
          {t("guestNote")}
        </p>
      ) : null}
      {snapshot.pending ? (
        <p role="status" className="mb-4 text-sm leading-relaxed text-ink">
          {t("pendingNote")}
        </p>
      ) : null}
      <ul className="grid gap-4">
        {snapshot.lines.map((line) => {
          const productState = products.get(line.productId) ?? { state: "loading" as const };
          const product = productState.state === "ready" ? productState.product : null;
          const name =
            product?.name ??
            (productState.state === "missing" ? t("missing") : t("loadingProduct"));
          const maxQty = product ? maxPurchasableQuantity(product) : 100;
          return (
            <li
              key={line.productId}
              className="grid gap-4 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-[5rem_1fr] sm:p-5"
            >
              <div className="relative size-20 overflow-hidden rounded-xl">
                <ProductImage url={product?.imageUrl ?? null} alt={product?.imageAlt ?? name} />
              </div>
              <div>
                <h2 className="font-display text-3xl text-ink">{name}</h2>
                {product ? (
                  <p className="mt-1 text-sm text-muted">
                    {t("price", { price: formatMinorPrice(product.priceMinor, product.currency) })}
                  </p>
                ) : null}
                {productState.state === "missing" ? (
                  <p className="mt-2 text-sm text-rose-deep">{t("removeBefore")}</p>
                ) : null}
                {product && line.quantity > maxQty ? (
                  <p className="mt-2 text-sm text-rose-deep">
                    {maxQty < 1 ? t("outOfStock") : t("onlyAvailable", { count: maxQty })}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <div role="group" aria-label={t("quantityFor", { name })} className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={t("decreaseFor", { name })}
                      disabled={snapshot.pending || line.quantity <= 1}
                      onClick={() => {
                        const result = updateDraftQuantity(userId, line.productId, line.quantity - 1);
                        if (result === "pending") {
                          setError(t("unfinished"));
                        }
                      }}
                      className="inline-flex size-11 items-center justify-center rounded-2xl border border-line bg-bg text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60"
                    >
                      −
                    </button>
                    <span className="min-w-8 text-center text-sm text-ink">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label={t("increaseFor", { name })}
                      disabled={snapshot.pending || line.quantity >= Math.min(100, Math.max(maxQty, line.quantity))}
                      onClick={() => {
                        const result = updateDraftQuantity(userId, line.productId, line.quantity + 1);
                        if (result === "pending") {
                          setError(t("unfinished"));
                        }
                      }}
                      className="inline-flex size-11 items-center justify-center rounded-2xl border border-line bg-bg text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60"
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    disabled={snapshot.pending}
                    onClick={() => removeDraftLine(userId, line.productId)}
                    className="text-sm text-rose-deep underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60"
                  >
                    {t("remove")}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">{t("estimated")}</p>
        <p className="mt-2 text-lg text-ink">{estimate ?? t("waitingPrices")}</p>
        <p className="mt-3 text-sm leading-relaxed text-muted">{t("priceNote")}</p>
      </div>
      <ErrorMessage message={error} className="mt-4 text-sm text-rose-deep" />
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          disabled={snapshot.pending || inFlight}
          onClick={() => {
            const result = clearVisibleDraft(userId);
            if (result === "pending") {
              setError(t("unfinished"));
            }
          }}
        >
          {t("clearOrder")}
        </Button>
        <Button
          type="button"
          disabled={inFlight || blocked || role !== "CUSTOMER"}
          onClick={() => void placeOrder()}
        >
          {inFlight ? t("placing") : snapshot.pending ? t("retry") : t("place")}
        </Button>
      </div>
    </div>
  );
}

function Confirmation({
  confirmation,
}: {
  confirmation: { orderId: number; status: OrderStatus; totalMinor: number; currency: string; };
}) {
  const t = useTranslations("checkout");
  const orders = useTranslations("orders");

  return (
    <div className="mt-8 rounded-2xl border border-line bg-surface p-5 shadow-[0_8px_24px_rgb(52_42_46/6%)] sm:p-8">
      <h2 className="font-display text-4xl text-ink">{t("placed")}</h2>
      <p className="mt-4 text-ink">{t("orderNumber", { id: confirmation.orderId })}</p>
      <p className="mt-2 text-sm text-muted">{orders(confirmation.status)}</p>
      <p className="mt-4 text-lg text-ink">
        {formatMinorPrice(confirmation.totalMinor, confirmation.currency)}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {t("noPayment")}
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button href="/shop" variant="secondary">
          {t("continue")}
        </Button>
        <Button href={`/account/orders/${confirmation.orderId}`}>{t("viewOrder")}</Button>
      </div>
    </div>
  );
}

function canSubmitLine(quantity: number, productState: ProductState | undefined): boolean {
  if (!productState || productState.state !== "ready") {
    return false;
  }
  const maxQty = maxPurchasableQuantity(productState.product);
  return quantity >= 1 && quantity <= maxQty;
}

function estimateTotal(
  lines: { productId: number; quantity: number; }[],
  products: Map<number, ProductState>,
): string | null {
  let currency: string | null = null;
  let total = 0;
  for (const line of lines) {
    const productState = products.get(line.productId);
    if (!productState || productState.state !== "ready") {
      return null;
    }
    if (currency && currency !== productState.product.currency) {
      return null;
    }
    currency = productState.product.currency;
    const next = total + productState.product.priceMinor * line.quantity;
    if (!Number.isSafeInteger(next)) {
      return null;
    }
    total = next;
  }
  return currency ? formatMinorPrice(total, currency) : null;
}
