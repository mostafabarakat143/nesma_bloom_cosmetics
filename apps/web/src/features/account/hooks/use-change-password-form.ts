"use client";

import { createValidation, type ChangePasswordSchema } from "@/shared/validation";

import { useErrorHandler } from "@/shared/use-error-handler";

import { useChangePassword } from "@/features/account/hooks/use-account-mutations";
import {
  isWrongCurrentPassword,
  type PasswordChangeErrors,
} from "@/features/account/lib/password-change";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

const defaultValidation = createValidation();

export function useChangePasswordForm(schema: ChangePasswordSchema) {
  const router = useRouter();
  const t = useTranslations("account");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<PasswordChangeErrors>({});
  const { error: formError, clearError, reportError, handleError } = useErrorHandler();
  const { mutateAsync: changePassword, isPending: pending } = useChangePassword();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearError();
    const parsed = defaultValidation.parse(schema, {
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }

    setErrors({});
    const result = await changePassword(parsed.value);

    if (result.ok) {
      router.push("/login?notice=password-changed");
      router.refresh();
      return;
    }

    if (result.status === 401 && isWrongCurrentPassword(result.message)) {
      reportError(result, defaultValidation.messages.unavailable);
      return;
    }
    handleError(result, {
      loginPath: "/login?next=%2Faccount%2Fchange-password&expired=1",
      fallback: defaultValidation.messages.unavailable,
    });
  }

  return {
    t,
    currentPassword,
    setCurrentPassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    errors,
    formError,
    pending,
    submit,
  };
}
