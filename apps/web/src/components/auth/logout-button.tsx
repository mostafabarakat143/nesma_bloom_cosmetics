"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";

import { KnownText } from "@/components/i18n/known-text";
import { useRouter } from "@/i18n/navigation";
import { MESSAGES } from "@/lib/auth/credentials";
import { SAME_ORIGIN_HEADER, SAME_ORIGIN_VALUE } from "@/lib/auth/origin";
import { clearGuestDraft } from "@/lib/order-draft";

const buttonClass = {
  inline:
    "rounded-md text-sm text-rose-deep hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rose-deep disabled:opacity-60",
  row: "block w-full rounded-xl px-3 py-2 text-start text-sm text-rose-deep hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60",
  menu: "block w-full rounded-2xl px-3 py-3 text-start text-base text-rose-deep hover:bg-blush focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-deep disabled:opacity-60",
} as const;

export function LogoutButton({
  onDone,
  className = "",
  appearance = "inline",
}: {
  onDone?: () => void;
  className?: string;
  appearance?: keyof typeof buttonClass;
}) {
  const router = useRouter();
  const t = useTranslations("common");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function logout() {
    setPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          accept: "application/json",
          [SAME_ORIGIN_HEADER]: SAME_ORIGIN_VALUE,
        },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      if (response.status === 503) {
        clearGuestDraft();
        onDone?.();
        router.push("/login?notice=revoke-unconfirmed");
        router.refresh();
        return;
      }
      if (!response.ok) {
        setMessage(
          typeof payload?.message === "string" ? payload.message : MESSAGES.unavailable,
        );
        return;
      }
      clearGuestDraft();
      onDone?.();
      router.refresh();
    } catch {
      setMessage(MESSAGES.unavailable);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={className} role={appearance === "row" ? "none" : undefined}>
      <button
        type="button"
        role={appearance === "row" ? "menuitem" : undefined}
        onClick={() => void logout()}
        disabled={pending}
        className={buttonClass[appearance]}
      >
        {pending ? t("loggingOut") : t("logout")}
      </button>
      {message ? (
        <p role="alert" className="mt-1 max-w-48 text-sm text-rose-deep">
          <KnownText value={message} />
        </p>
      ) : null}
    </div>
  );
}
