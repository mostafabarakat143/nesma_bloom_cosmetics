"use client";

import { ErrorMessage } from "@/components/ui/error-message";

import { useOrderActions } from "@/features/orders/hooks/use-order-actions";

import { Button } from "@/components/ui/button";
import { type OrderStatus } from "@/features/orders/lib/parse";

export function OrderActions({
  orderId,
  status,
}: {
  orderId: number;
  status: OrderStatus;
}) {
  const { t, dialogRef, titleId, pending, notice, error, confirmCancel } = useOrderActions({ orderId });

  return (
    <div className="mt-8">
      {notice ? (
        <p role="status" className="text-sm text-ink">
          {notice}
        </p>
      ) : null}
      {status === "PENDING" ? (
        <div className={notice ? "mt-4 flex justify-end" : "flex justify-end"}>
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.showModal()}>
            {t("cancel")}
          </Button>
        </div>
      ) : null}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="fixed top-20 left-1/2 m-0 w-[min(100%-2rem,36rem)] -translate-x-1/2 rounded-2xl border border-line bg-surface px-5 py-3 text-ink backdrop:bg-[rgb(52_42_46/40%)]"
      >
        <h2 id={titleId} className="font-display text-2xl leading-none text-ink">
          {t("cancelAsk")}
        </h2>
        <p className="mt-1.5 text-sm leading-snug text-muted">{t("cancelBody")}</p>
        <ErrorMessage message={error} className="mt-4 text-sm text-rose-deep" />
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            autoFocus
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
            className="!h-9 !px-4"
          >
            {t("keep")}
          </Button>
          <Button
            type="button"
            disabled={pending}
            onClick={() => void confirmCancel()}
            className="!h-9 !px-4"
          >
            {pending ? t("cancelling") : t("cancel")}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
