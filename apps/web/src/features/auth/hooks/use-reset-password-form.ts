"use client";

import { createValidation, type ResetPasswordSchema } from "@/shared/validation";

import { useErrorHandler } from "@/shared/use-error-handler";

import { useResetToken } from "@/features/auth/components/reset-token";
import { useResetPassword } from "@/features/auth/hooks/use-auth-mutations";
import type { FieldErrors } from "@/features/auth/lib/credentials";

import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

const defaultValidation = createValidation();

export function useResetPasswordForm(schema: ResetPasswordSchema) {
  const token = useResetToken();
  const router = useRouter();
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const { error: formError, setError: setFormError, clearError, reportError } = useErrorHandler();
  const { mutateAsync: resetPassword, isPending: pending } = useResetPassword();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setFormError(defaultValidation.messages.resetInvalid);
      return;
    }

    const parsed = defaultValidation.parse(schema, { newPassword: password });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      clearError();
      return;
    }

    setErrors({});
    clearError();
    const result = await resetPassword({
      token,
      newPassword: parsed.value.newPassword,
    });

    if (!result.ok) {
      reportError(result);
      return;
    }

    router.push("/login?notice=reset");
    router.refresh();
  }

  return { t, token, password, setPassword, errors, formError, pending, onSubmit };
}
