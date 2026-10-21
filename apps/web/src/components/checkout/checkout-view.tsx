"use client";

import { useTranslations } from "next-intl";

import { KnownText } from "@/components/i18n/known-text";
import { useRouter } from "@/i18n/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { ProductImage } from "@/components/catalog/product-image";
import { EmptyState } from "@/components/catalog/empty-state";
import { postAuth } from "@/components/auth/post-auth";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/lib/auth/credentials";
import {
  beginOrderSubmit,
  clearVisibleDraft,
  finishOrderSubmit,
  releaseOrderKey,
  readDraftSnapshot,
  removeDraftLine,
  serverDraftSnapshot,
  subscribeDraft,
  updateDraftQuantity,
} from "@/lib/order-draft";
import { formatMinorPrice } from "@/lib/money";
import { parseOrder, type OrderStatus } from "@/lib/orders/parse";
import { maxPurchasableQuantity } from "@/lib/orders/payload";

const ORDER_WHATSAPP_NUMBER = "201015981398";

function orderWhatsappUrl(orderId: number) {
  const text = `تاكيد الاوردر رقم ${orderId}`;
  return `https://wa.me/${ORDER_WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

type ReadyProduct = {
  id: number;
  name: string;
  priceMinor: number;
  currency: string;
  inStock: boolean;
  stockQty: number | null;
  imageUrl: string | null;
  imageAlt: string;
};

type ProductState =
  | { state: "loading" }
  | { state: "missing" }
  | { state: "unavailable" }
  | { state: "ready"; product: ReadyProduct };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

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

async function loadProduct(id: number): Promise<ProductState> {
  try {
    const response = await fetch(`/api/catalog/products/${id}`, {
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

export function CheckoutView({
  userId,
  role,
}: {
  userId: number;
  role: "CUSTOMER" | "ADMIN";
}) {
  const router = useRouter();
  const t = useTranslations("checkout");
  const snapshot = useSyncExternalStore(
    subscribeDraft,
    () => readDraftSnapshot(userId),
    serverDraftSnapshot,
  );
  const [products, setProducts] = useState<Map<number, ProductState>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(false);

  const lineKey = snapshot.lines.map((line) => line.productId).join(",");

  useEffect(() => {
    if (!snapshot.ready || snapshot.lines.length === 0) {
      return;
    }
    let cancelled = false;
    const ids = snapshot.lines.map((line) => line.productId);
    void (async () => {
      const entries = await Promise.all(ids.map(async (id) => [id, await loadProduct(id)] as const));
      if (cancelled) {
        return;
      }
      setProducts((current) => {
        const next = new Map(current);
        for (const [id, value] of entries) {
          next.set(id, value);
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshot.ready, lineKey, snapshot.lines]);

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

  async function placeOrder() {
    if (role !== "CUSTOMER" || inFlight) {
      return;
    }
    setInFlight(true);
    setError(null);
    const started = beginOrderSubmit(userId);
    if (!started.ok) {
      setError(started.message);
      setInFlight(false);
      return;
    }

    const whatsappTab = window.open("about:blank", "_blank");

    const result = await postAuth("/api/orders", { items: started.items }, "POST", {
      "idempotency-key": started.key,
    });

    if (result.ok) {
      const order = parseOrder(result.data.order);
      if (!order) {
        whatsappTab?.close();
        finishOrderSubmit(userId, "uncertain");
        setError(
          t("unreadable"),
        );
        setInFlight(false);
        return;
      }
      const whatsappUrl = orderWhatsappUrl(order.id);
      if (whatsappTab && !whatsappTab.closed) {
        whatsappTab.location.replace(whatsappUrl);
      } else {
        window.location.assign(whatsappUrl);
      }
      finishOrderSubmit(userId, "success", {
        orderId: order.id,
        status: order.status,
        totalMinor: order.totalMinor,
        currency: order.currency,
      });
      setInFlight(false);
      return;
    }

    whatsappTab?.close();

    if (result.status === 0 || result.status === 503) {
      finishOrderSubmit(userId, "uncertain");
      setError(result.message || MESSAGES.unavailable);
      setInFlight(false);
      return;
    }

    if (result.status === 409 && result.message.includes("already in progress")) {
      finishOrderSubmit(userId, "uncertain");
      setError(result.message);
      setInFlight(false);
      return;
    }

    if (result.status === 409 && result.message.includes("different request payload")) {
      releaseOrderKey(userId);
      setError(
        t("mismatch"),
      );
      setInFlight(false);
      return;
    }

    finishOrderSubmit(userId, "settled");
    if (result.status === 401) {
      router.push("/login?next=%2Fcheckout&expired=1");
      router.refresh();
      return;
    }
    setError(result.message || MESSAGES.unavailable);
    setInFlight(false);
  }

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
      {error ? (
        <p role="alert" className="mt-4 text-sm text-rose-deep">
          <KnownText value={error} />
        </p>
      ) : null}
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
  confirmation: { orderId: number; status: OrderStatus; totalMinor: number; currency: string };
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
  lines: { productId: number; quantity: number }[],
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
