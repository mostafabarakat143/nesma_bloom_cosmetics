"use client";

import { ShoppingBag } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { showToast } from "@/components/ui/toast";
import { Link } from "@/i18n/navigation";
import { addProduct, readDraftSnapshot, removeDraftLine, subscribeDraft, updateDraftQuantity } from "@/lib/order-draft";
import { maxPurchasableQuantity } from "@/lib/orders/payload";

export function AddToOrder({
  productId,
  inStock,
  stockQty,
  ownerId,
  accountUnavailable,
  compact = false,
  /** When compact on a light image, use dark qty controls. */
  compactOnLight = false,
}: {
  productId: number;
  inStock: boolean;
  stockQty: number | null;
  ownerId: number | null;
  accountUnavailable: boolean;
  compact?: boolean;
  compactOnLight?: boolean;
}) {
  const t = useTranslations("product");
  const maxQty = maxPurchasableQuantity({ inStock, stockQty });
  const [quantity, setQuantity] = useState(1);
  const [units, setUnits] = useState(0);
  const tracksUnits = compact && ownerId !== null;
  const shown = tracksUnits ? units : quantity;

  useEffect(() => {
    if (!tracksUnits || ownerId === null) {
      return;
    }
    const read = () => {
      const line = readDraftSnapshot(ownerId).lines.find((item) => item.productId === productId);
      setUnits(line?.quantity ?? 0);
    };
    read();
    return subscribeDraft(read);
  }, [tracksUnits, ownerId, productId]);

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

  function setCartUnits(next: number) {
    if (ownerId === null || !Number.isInteger(next)) {
      return;
    }
    if (next < 1) {
      const result = removeDraftLine(ownerId, productId);
      if (result === "pending") {
        showToast(t("pending"), "error");
      }
      return;
    }
    const capped = Math.min(next, Math.max(maxQty, 1));
    if (units < 1) {
      const result = addProduct(ownerId, productId, capped, maxQty);
      if (result === "full" || result === "pending" || result === "unavailable" || result === "invalid") {
        showToast(
          result === "full"
            ? t("full")
            : result === "pending"
              ? t("pending")
              : result === "unavailable"
                ? t("outOfStock")
                : t("quantityError"),
          "error",
        );
      }
      return;
    }
    if (capped === units) {
      return;
    }
    const result = updateDraftQuantity(ownerId, productId, capped);
    if (result === "pending") {
      showToast(t("pending"), "error");
    } else if (result === "invalid") {
      showToast(t("quantityError"), "error");
    }
  }

  function add() {
    if (ownerId === null) {
      return;
    }
    const result = addProduct(ownerId, productId, tracksUnits ? 1 : quantity, maxQty);
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

  if (compact) {
    const onLight = compactOnLight;
    const glassControl = onLight
      ? "inline-flex h-7 w-7 shrink-0 items-center justify-center text-ink hover:bg-ink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-50"
      : "inline-flex h-7 w-7 shrink-0 items-center justify-center text-white hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-50";
    const qtyBorder = onLight ? "border-ink/40 bg-white/40" : "border-white/70 bg-white/10";
    const qtyDivider = onLight ? "border-ink/25" : "border-white/40";
    const qtyInput = onLight
      ? "h-7 w-6 border-0 bg-transparent text-center text-[11px] text-ink focus-visible:outline-none"
      : "h-7 w-6 border-0 bg-transparent text-center text-[11px] text-white focus-visible:outline-none";
    const addClass =
      "inline-flex h-7 min-w-0 flex-1 items-center justify-center gap-1 rounded-full bg-rose-deep px-2 text-[11px] font-medium text-white hover:bg-rose-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:pointer-events-none disabled:opacity-60";

    if (maxQty === 0) {
      return null;
    }

    return (
      <div className="mt-2 flex items-center gap-1.5">
        <div
          role="group"
          aria-label={t("quantity")}
          className={`inline-flex shrink-0 items-center overflow-hidden rounded-full border ${qtyBorder}`}
        >
          <button
            type="button"
            aria-label={t("decrease")}
            disabled={shown <= (tracksUnits ? 0 : 1)}
            onClick={() =>
              tracksUnits ? setCartUnits(shown - 1) : changeQuantity(shown - 1)
            }
            className={`${glassControl} border-e ${qtyDivider}`}
          >
            −
          </button>
          <input
            id={`quantity-${productId}`}
            aria-label={t("quantity")}
            inputMode="numeric"
            value={String(shown)}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (event.target.value.trim() === "") {
                if (tracksUnits) {
                  setCartUnits(0);
                } else {
                  setQuantity(1);
                }
                return;
              }
              if (Number.isInteger(next)) {
                if (tracksUnits) {
                  setCartUnits(next);
                } else {
                  changeQuantity(next);
                }
              }
            }}
            className={qtyInput}
          />
          <button
            type="button"
            aria-label={t("increase")}
            disabled={shown >= maxQty}
            onClick={() =>
              tracksUnits ? setCartUnits(shown + 1) : changeQuantity(shown + 1)
            }
            className={`${glassControl} border-s ${qtyDivider}`}
          >
            +
          </button>
        </div>
        {ownerId === null ? (
          <Link href={loginHref} className={addClass}>
            <ShoppingBag className="size-3 shrink-0" aria-hidden="true" strokeWidth={2} />
            <span className="truncate">{t("add")}</span>
          </Link>
        ) : (
          <button
            type="button"
            disabled={units >= maxQty}
            onClick={(event) => {
              add();
              event.currentTarget.blur();
            }}
            className={addClass}
          >
            <ShoppingBag className="size-3 shrink-0" aria-hidden="true" strokeWidth={2} />
            <span className="truncate">{t("add")}</span>
          </button>
        )}
      </div>
    );
  }

  const controlClass =
    "inline-flex size-11 items-center justify-center rounded-2xl border border-line bg-surface text-ink hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60";
  const inputClass =
    "h-11 w-16 rounded-2xl border border-line bg-bg text-center text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep";

  const addButton =
    ownerId === null ? (
      <Button href={loginHref}>{t("add")}</Button>
    ) : (
      <Button
        type="button"
        disabled={maxQty === 0}
        onClick={(event) => {
          add();
          event.currentTarget.blur();
        }}
      >
        {t("add")}
      </Button>
    );

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
              disabled={shown <= 1}
              onClick={() => changeQuantity(shown - 1)}
              className={controlClass}
            >
              −
            </button>
            <input
              id={`quantity-${productId}`}
              aria-label={t("quantity")}
              inputMode="numeric"
              value={String(shown)}
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
              disabled={shown >= maxQty}
              onClick={() => changeQuantity(shown + 1)}
              className={controlClass}
            >
              +
            </button>
          </div>
          <p className="text-sm text-muted">
            {stockQty !== null ? t("availableCount", { count: stockQty }) : t("available")}
          </p>
        </div>
      )}
      {maxQty === 0 ? null : (
        <div className="mt-4 flex flex-wrap gap-3">{addButton}</div>
      )}
    </div>
  );
}
