"use client";

import { createValidation, type RegisterSchema } from "@/shared/validation";

import { useErrorHandler } from "@/shared/use-error-handler";

import { useRegister } from "@/features/auth/hooks/use-auth-mutations";
import type { FieldErrors } from "@/features/auth/lib/credentials";
import { safeNextPath } from "@/features/auth/lib/session";
import { useRouter } from "@/i18n/navigation";
import { splitLocaleHref } from "@/i18n/pathname";
import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

const defaultValidation = createValidation();

export function useRegisterForm({ nextPath, schema }: { nextPath: string; schema: RegisterSchema }) {
  const router = useRouter();
  const t = useTranslations("auth");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const { error: formError, clearError, reportError } = useErrorHandler();
  const { mutateAsync: register, isPending: pending } = useRegister();
  const loginHref =
    nextPath === "/shop" ? "/login" : `/login?next=${encodeURIComponent(nextPath)}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = defaultValidation.parse(schema, { email, password, firstName, lastName });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      clearError();
      return;
    }

    setErrors({});
    clearError();
    const result = await register({
      ...parsed.value,
      next: nextPath,
    });

    if (!result.ok) {
      reportError(result);
      return;
    }

    const destination = splitLocaleHref(safeNextPath(result.data.redirectTo));
    router.push(destination.href, destination.locale ? { locale: destination.locale } : undefined);
    router.refresh();
  }

  return {
    t,
    firstName,
    setFirstName,
    lastName,
    setLastName,
    email,
    setEmail,
    password,
    setPassword,
    errors,
    formError,
    pending,
    loginHref,
    onSubmit,
  };
}
