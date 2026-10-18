"use client";

import { useTranslations } from "next-intl";

import { KnownText } from "@/components/i18n/known-text";
import { useRouter } from "@/i18n/navigation";
import { useId, useRef, useState } from "react";

import { postAuth } from "@/components/auth/post-auth";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/lib/auth/credentials";
import { parseOrder, type OrderStatus } from "@/lib/orders/parse";

export function OrderActions({
  orderId,
  status,
}: {
  orderId: number;
  status: OrderStatus;
}) {
  const router = useRouter();
  const t = useTranslations("orders");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmCancel() {
    setPending(true);
    setError(null);
    const result = await postAuth(`/api/orders/${orderId}/cancel`, {});
    setPending(false);

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

    if (result.status === 401) {
      router.push(`/login?next=${encodeURIComponent(`/account/orders/${orderId}`)}&expired=1`);
      router.refresh();
      return;
    }

    setError(result.message || MESSAGES.unavailable);
    if (result.status === 409) {
      router.refresh();
    }
  }

  return (
    <div className="mt-8">
      {notice ? (
        <p role="status" className="text-sm text-ink">
          {notice}
        </p>
      ) : null}
      {status === "PENDING" ? (
        <div className={notice ? "mt-4" : undefined}>
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.showModal()}>
            {t("cancel")}
          </Button>
        </div>
      ) : null}
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="w-[min(100%-2rem,28rem)] rounded-2xl border border-line bg-surface p-6 text-ink backdrop:bg-[rgb(52_42_46/40%)]"
      >
        <h2 id={titleId} className="font-display text-3xl text-ink">
          {t("cancelAsk")}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{t("cancelBody")}</p>
        {error ? (
          <p role="alert" className="mt-4 text-sm text-rose-deep">
            <KnownText value={error} />
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button
            type="button"
            variant="secondary"
            autoFocus
            disabled={pending}
            onClick={() => dialogRef.current?.close()}
          >
            {t("keep")}
          </Button>
          <Button type="button" disabled={pending} onClick={() => void confirmCancel()}>
            {pending ? t("cancelling") : t("cancel")}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
