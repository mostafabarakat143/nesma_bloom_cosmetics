"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { addProduct } from "@/lib/order-draft";
import { maxPurchasableQuantity } from "@/lib/orders/payload";

export function AddToOrder({
  productId,
  inStock,
  stockQty,
  ownerId,
  accountUnavailable,
  compact = false,
}: {
  productId: number;
  inStock: boolean;
  stockQty: number | null;
  ownerId: number | null;
  accountUnavailable: boolean;
  compact?: boolean;
}) {
  const t = useTranslations("product");
  const maxQty = maxPurchasableQuantity({ inStock, stockQty });
  const [quantity, setQuantity] = useState(1);

  const loginHref = `/login?next=${encodeURIComponent(`/products/${productId}`)}`;

  if (accountUnavailable) {
    if (compact) {
      return null;
    }
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
    if (ownerId === null) {
      return;
    }
    const result = addProduct(ownerId, productId, quantity, maxQty);
    if (result === "added") {
      showToast(t("added"));
      return;
    }
    if (result === "clamped") {
      showToast(t("addedClamped"));
      return;
    }
    if (result === "full") {
      showToast(t("full"), "error");
      return;
    }
    if (result === "pending") {
      showToast(t("pending"), "error");
      return;
    }
    if (result === "unavailable") {
      showToast(t("outOfStock"), "error");
      return;
    }
    showToast(t("quantityError"), "error");
  }

  const controlClass = compact
    ? "inline-flex size-9 items-center justify-center rounded-xl border border-line bg-surface text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60"
    : "inline-flex size-11 items-center justify-center rounded-2xl border border-line bg-surface text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60";
  const inputClass = compact
    ? "h-9 w-12 rounded-xl border border-line bg-bg text-center text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep"
    : "h-11 w-16 rounded-2xl border border-line bg-bg text-center text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep";

  const addButton =
    ownerId === null ? (
      <Button href={loginHref} className={compact ? "!h-8 shrink-0 !px-3 !text-xs" : undefined}>
        {t("add")}
      </Button>
    ) : (
      <Button
        type="button"
        disabled={maxQty === 0}
        onClick={(event) => {
          add();
          event.currentTarget.blur();
        }}
        className={compact ? "!h-8 shrink-0 !px-3 !text-xs" : undefined}
      >
        {t("add")}
      </Button>
    );

  return (
    <div className={compact ? "mt-3" : "mt-6"}>
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
              className={controlClass}
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
              className={inputClass}
            />
            <button
              type="button"
              aria-label={t("increase")}
              disabled={quantity >= maxQty}
              onClick={() => changeQuantity(quantity + 1)}
              className={controlClass}
            >
              +
            </button>
          </div>
          {compact ? null : (
            <p className="text-sm text-muted">
              {stockQty !== null ? t("availableCount", { count: stockQty }) : t("available")}
            </p>
          )}
        </div>
      )}
      {maxQty === 0 ? null : compact ? (
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="min-w-0 text-sm text-muted">
            {stockQty !== null ? t("availableCount", { count: stockQty }) : t("available")}
          </p>
          {addButton}
        </div>
      ) : (
        <div className="mt-4 flex flex-wrap gap-3">{addButton}</div>
      )}
    </div>
  );
}
