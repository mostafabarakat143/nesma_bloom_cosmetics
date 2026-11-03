"use client";

import { createValidation } from "@/shared/validation";

import { ErrorMessage } from "@/components/ui/error-message";

import { useTranslations } from "next-intl";

import { useForgotPasswordForm } from "@/features/auth/hooks/use-forgot-password-form";

import { KnownText } from "@/components/i18n/known-text";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/fields";
import { authLinkClass } from "@/features/auth/components/auth-shell";
import { Link } from "@/i18n/navigation";

export function ForgotPasswordForm() {
  const validationT = useTranslations("validation");
  const validation = createValidation(validationT);
  const schema = validation.auth.forgotPassword();
  const { t, email, setEmail, errors, formError, success, pending, onSubmit } = useForgotPasswordForm(schema);

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-5" noValidate>
      <TextField
        id="forgot-email"
        label={t("email")}
        type="email"
        autoComplete="email"
        placeholder={t("emailPlaceholder")}
        value={email}
        error={errors.email}
        maxLength={255}
        onChange={setEmail}
      />
      <ErrorMessage message={formError} className="text-sm text-rose-deep" />
      {success ? (
        <p role="status" className="text-sm leading-relaxed text-ink">
          <KnownText value={success} />
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("sending") : t("sendReset")}
      </Button>
      <p className="text-sm text-muted">
        <Link href="/login" className={authLinkClass()}>
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}
