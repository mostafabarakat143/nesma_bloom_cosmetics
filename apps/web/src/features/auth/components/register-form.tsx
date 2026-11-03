"use client";

import { createValidation } from "@/shared/validation";

import { ErrorMessage } from "@/components/ui/error-message";

import { useTranslations } from "next-intl";

import { useRegisterForm } from "@/features/auth/hooks/use-register-form";

import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/fields";
import { authLinkClass } from "@/features/auth/components/auth-shell";
import { Link } from "@/i18n/navigation";
export function RegisterForm({ nextPath }: { nextPath: string; }) {
  const validationT = useTranslations("validation");
  const validation = createValidation(validationT);
  const schema = validation.auth.register();
  const {
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
  } = useRegisterForm({ nextPath, schema });

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-5" noValidate>
      <TextField
        id="register-first-name"
        label={t("firstName")}
        autoComplete="given-name"
        placeholder={t("firstNamePlaceholder")}
        value={firstName}
        error={errors.firstName}
        maxLength={100}
        onChange={setFirstName}
      />
      <TextField
        id="register-last-name"
        label={t("lastName")}
        autoComplete="family-name"
        placeholder={t("lastNamePlaceholder")}
        value={lastName}
        error={errors.lastName}
        maxLength={100}
        onChange={setLastName}
      />
      <TextField
        id="register-email"
        label={t("email")}
        type="email"
        autoComplete="email"
        placeholder={t("emailPlaceholder")}
        value={email}
        error={errors.email}
        maxLength={255}
        onChange={setEmail}
      />
      <PasswordField
        id="register-password"
        label={t("password")}
        autoComplete="new-password"
        placeholder={t("enterPassword")}
        value={password}
        error={errors.password}
        onChange={setPassword}
      />
      <ErrorMessage message={formError} className="text-sm text-rose-deep" />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("creatingAccount") : t("createAccount")}
      </Button>
      <p className="text-sm text-muted">
        {t("alreadyHave")}{" "}
        <Link href={loginHref} className={authLinkClass()}>
          {t("login")}
        </Link>
      </p>
    </form>
  );
}
