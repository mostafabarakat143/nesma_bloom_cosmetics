"use client";

import { createValidation, type ForgotPasswordSchema } from "@/shared/validation";

import { useErrorHandler } from "@/shared/use-error-handler";

import { useForgotPassword } from "@/features/auth/hooks/use-auth-mutations";
import type { FieldErrors } from "@/features/auth/lib/credentials";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

const defaultValidation = createValidation();

export function useForgotPasswordForm(schema: ForgotPasswordSchema) {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const { error: formError, clearError, reportError } = useErrorHandler();
  const [success, setSuccess] = useState<string | null>(null);
  const { mutateAsync: forgotPassword, isPending: pending } = useForgotPassword();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = defaultValidation.parse(schema, { email });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      clearError();
      setSuccess(null);
      return;
    }

    setErrors({});
    clearError();
    const result = await forgotPassword(parsed.value);

    if (!result.ok) {
      setSuccess(null);
      reportError(result);
      return;
    }

    setSuccess(
      typeof result.data.message === "string" ? result.data.message : defaultValidation.messages.forgot,
    );
  }

  return { t, email, setEmail, errors, formError, success, pending, onSubmit };
}
