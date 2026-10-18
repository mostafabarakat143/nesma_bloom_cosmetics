"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { addProduct } from "@/lib/order-draft";
import { maxPurchasableQuantity } from "@/lib/orders/payload";

export function AddToOrder({
  productId,
  inStock,
  stockQty,
  ownerId,
  accountUnavailable,
}: {
  productId: number;
  inStock: boolean;
  stockQty: number | null;
  ownerId: number | null;
  accountUnavailable: boolean;
}) {
  const t = useTranslations("product");
  const maxQty = maxPurchasableQuantity({ inStock, stockQty });
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (accountUnavailable) {
    return (
      <p role="status" className="mt-6 text-sm text-muted">
        {t("browseNote")}
      </p>
    );
  }

  function changeQuantity(next: number) {
    if (!Number.isInteger(next)) {
      return;
    }
    setQuantity(Math.min(Math.max(next, 1), Math.max(maxQty, 1)));
  }

  function add() {
    setError(null);
    setMessage(null);
    const result = addProduct(ownerId ?? "guest", productId, quantity, maxQty);
    if (result === "added") {
      setMessage(t("added"));
      return;
    }
    if (result === "clamped") {
      setMessage(t("addedClamped"));
      return;
    }
    if (result === "full") {
      setError(t("full"));
      return;
    }
    if (result === "pending") {
      setError(t("pending"));
      return;
    }
    if (result === "unavailable") {
      setError(t("outOfStock"));
      return;
    }
    setError(t("quantityError"));
  }

  return (
    <div className="mt-6">
      {maxQty === 0 ? (
        <p className="text-sm text-rose-deep">{t("outOfStock")}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label={t("quantity")} className="flex items-center gap-2">
            <button
              type="button"
              aria-label={t("decrease")}
              disabled={quantity <= 1}
              onClick={() => changeQuantity(quantity - 1)}
              className="inline-flex size-11 items-center justify-center rounded-2xl border border-line bg-surface text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60"
            >
              −
            </button>
            <input
              id={`quantity-${productId}`}
              aria-label={t("quantity")}
              inputMode="numeric"
              value={String(quantity)}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (event.target.value.trim() === "") {
                  setQuantity(1);
                  return;
                }
                if (Number.isInteger(next)) {
                  changeQuantity(next);
                }
              }}
              className="h-11 w-16 rounded-2xl border border-line bg-bg text-center text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
            />
            <button
              type="button"
              aria-label={t("increase")}
              disabled={quantity >= maxQty}
              onClick={() => changeQuantity(quantity + 1)}
              className="inline-flex size-11 items-center justify-center rounded-2xl border border-line bg-surface text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60"
            >
              +
            </button>
          </div>
          <p className="text-sm text-muted">
            {stockQty !== null ? t("availableCount", { count: stockQty }) : t("available")}
          </p>
        </div>
      )}
      {message ? (
        <p role="status" className="mt-4 text-sm text-ink">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-rose-deep">
          {error}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        <Button type="button" disabled={maxQty === 0} onClick={add}>
          {t("add")}
        </Button>
        <Button href="/checkout" variant="secondary">
          {t("review")}
        </Button>
      </div>
    </div>
  );
}
