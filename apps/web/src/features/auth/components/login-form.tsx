"use client";

import { createValidation } from "@/shared/validation";

import { ErrorMessage } from "@/components/ui/error-message";

import { useTranslations } from "next-intl";

import { useLoginForm } from "@/features/auth/hooks/use-login-form";

import { Button } from "@/components/ui/button";
import { PasswordField, TextField } from "@/components/ui/fields";
import { authLinkClass } from "@/features/auth/components/auth-shell";
import { Link } from "@/i18n/navigation";

export function LoginForm({ nextPath }: { nextPath: string; }) {
  const validationT = useTranslations("validation");
  const validation = createValidation(validationT);
  const schema = validation.auth.login();
  const { t, email, setEmail, password, setPassword, errors, formError, pending, registerHref, onSubmit } = useLoginForm({ nextPath, schema });

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-5" noValidate>
      <TextField
        id="login-email"
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
        id="login-password"
        label={t("password")}
        autoComplete="current-password"
        placeholder={t("yourPassword")}
        value={password}
        error={errors.password}
        onChange={setPassword}
      />
      <ErrorMessage message={formError} className="text-sm text-rose-deep" />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("loggingIn") : t("login")}
      </Button>
      <p className="text-sm text-muted">
        <Link href="/forgot-password" className={authLinkClass()}>
          {t("forgotLink")}
        </Link>
      </p>
      <p className="text-sm text-muted">
        {t("newToLamsa")}{" "}
        <Link href={registerHref} className={authLinkClass()}>
          {t("createAccount")}
        </Link>
      </p>
    </form>
  );
}
