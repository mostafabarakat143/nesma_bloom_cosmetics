"use client";

import { useErrorHandler } from "@/shared/use-error-handler";

import { useLogout } from "@/features/auth/hooks/use-auth-mutations";
import { clearGuestDraft } from "@/features/orders/lib/order-draft";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

export function useLogoutButton({ onDone }: { onDone?: () => void; }) {
  const router = useRouter();
  const t = useTranslations("common");
  const { mutateAsync: requestLogout, isPending: pending } = useLogout();
  const { error: message, clearError, reportError } = useErrorHandler();

  async function logout() {
    clearError();
    try {
      const response = await requestLogout();
      if (response.status === 503) {
        clearGuestDraft();
        onDone?.();
        router.push("/login?notice=revoke-unconfirmed");
        router.refresh();
        return;
      }
      if (!response.ok) {
        reportError(response);
        return;
      }
      clearGuestDraft();
      onDone?.();
      router.refresh();
    } catch {
      reportError(undefined);
    }
  }

  return { t, pending, message, logout };
}
