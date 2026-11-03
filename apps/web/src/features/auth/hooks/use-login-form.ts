"use client";

import { createValidation, type LoginSchema } from "@/shared/validation";

import { useErrorHandler } from "@/shared/use-error-handler";

import { useLogin } from "@/features/auth/hooks/use-auth-mutations";
import type { FieldErrors } from "@/features/auth/lib/credentials";

import { safeNextPath } from "@/features/auth/lib/session";
import { useRouter } from "@/i18n/navigation";
import { splitLocaleHref } from "@/i18n/pathname";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

const defaultValidation = createValidation();

export function useLoginForm({ nextPath, schema }: { nextPath: string; schema: LoginSchema }) {
  const router = useRouter();
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const { error: formError, clearError, reportError } = useErrorHandler();
  const { mutateAsync: login, isPending: pending } = useLogin();
  const registerHref =
    nextPath === "/shop" ? "/register" : `/register?next=${encodeURIComponent(nextPath)}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = defaultValidation.parse(schema, { email, password });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      clearError();
      return;
    }

    setErrors({});
    clearError();
    const result = await login({
      email: parsed.value.email,
      password: parsed.value.password,
      next: nextPath,
    });

    if (!result.ok) {
      reportError(result, defaultValidation.messages.loginFailed);
      return;
    }

    const destination = splitLocaleHref(safeNextPath(result.data.redirectTo));
    router.push(destination.href, destination.locale ? { locale: destination.locale } : undefined);
    router.refresh();
  }

  return { t, email, setEmail, password, setPassword, errors, formError, pending, registerHref, onSubmit };
}
