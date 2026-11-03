"use client";

import { createValidation } from "@/shared/validation";

import { useErrorHandler } from "@/shared/use-error-handler";

import { useCancelOrder } from "@/features/orders/hooks/use-order-mutations";
import { parseOrder } from "@/features/orders/lib/parse";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

const defaultValidation = createValidation();

export function useOrderActions({ orderId }: { orderId: number; }) {
  const router = useRouter();
  const t = useTranslations("orders");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const { mutateAsync: cancelOrder, isPending: pending } = useCancelOrder();
  const [notice, setNotice] = useState<string | null>(null);
  const { error, clearError, handleError } = useErrorHandler();

  async function confirmCancel() {
    clearError();
    const result = await cancelOrder(orderId);

    if (result.ok) {
      const order = parseOrder(result.data.order);
      setNotice(
        order?.status === "CANCELLED"
          ? t("cancelled")
          : t("updated"),
      );
      dialogRef.current?.close();
      router.refresh();
      return;
    }

    handleError(result, {
      loginPath: `/login?next=${encodeURIComponent(`/account/orders/${orderId}`)}&expired=1`,
      fallback: defaultValidation.messages.unavailable,
      refreshOnConflict: true,
    });
  }

  return { t, dialogRef, titleId, pending, notice, error, confirmCancel };
}
