"use client";

import { createValidation } from "@/shared/validation";

import { useErrorHandler } from "@/shared/use-error-handler";

import { orderWhatsappUrl } from "../services/orders.service";

import { useCheckoutProducts } from "@/features/catalog/hooks/use-checkout-products";
import { useCreateOrder } from "@/features/orders/hooks/use-order-mutations";
import {
  beginOrderSubmit,
  finishOrderSubmit,
  readDraftSnapshot,
  releaseOrderKey,
  serverDraftSnapshot,
  subscribeDraft
} from "@/features/orders/lib/order-draft";
import { parseOrder } from "@/features/orders/lib/parse";
import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";

const defaultValidation = createValidation();

export function useCheckout({ userId, role }: { userId: number; role: "CUSTOMER" | "ADMIN"; }) {
  const t = useTranslations("checkout");
  const snapshot = useSyncExternalStore(
    subscribeDraft,
    () => readDraftSnapshot(userId),
    serverDraftSnapshot,
  );
  const products = useCheckoutProducts(userId, snapshot);
  const { mutateAsync: createOrder } = useCreateOrder();
  const { error, setError, clearError, reportError, handleError } = useErrorHandler();
  const [inFlight, setInFlight] = useState(false);

  async function placeOrder() {
    if (role !== "CUSTOMER" || inFlight) {
      return;
    }
    setInFlight(true);
    clearError();
    const started = beginOrderSubmit(userId);
    if (!started.ok) {
      setError(started.message);
      setInFlight(false);
      return;
    }

    const whatsappTab = window.open("about:blank", "_blank");

    const result = await createOrder({ items: started.items, key: started.key });

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
      reportError(result, defaultValidation.messages.unavailable);
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
    if (handleError(result, {
      loginPath: "/login?next=%2Fcheckout&expired=1",
      fallback: defaultValidation.messages.unavailable,
    })) return;
    setInFlight(false);
  }

  return { t, snapshot, products, error, setError, inFlight, placeOrder };
}
