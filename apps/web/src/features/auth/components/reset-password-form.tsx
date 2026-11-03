"use client";

import { createValidation } from "@/shared/validation";

import { ErrorMessage } from "@/components/ui/error-message";

import { useTranslations } from "next-intl";

import { useResetPasswordForm } from "@/features/auth/hooks/use-reset-password-form";

import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/fields";
import { authLinkClass } from "@/features/auth/components/auth-shell";

import { Link } from "@/i18n/navigation";

const defaultValidation = createValidation();

export function ResetPasswordForm() {
  const validationT = useTranslations("validation");
  const validation = createValidation(validationT);
  const schema = validation.auth.resetPassword();
  const { t, token, password, setPassword, errors, formError, pending, onSubmit } = useResetPasswordForm(schema);

  if (!token) {
    return (
      <div className="space-y-5">
        <ErrorMessage message={defaultValidation.messages.resetInvalid} className="text-sm leading-relaxed text-rose-deep" />
        <p className="text-sm text-muted">
          <Link href="/forgot-password" className={authLinkClass()}>
            {t("requestNew")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-5" noValidate>
      <PasswordField
        id="reset-password"
        label={t("newPassword")}
        autoComplete="new-password"
        value={password}
        error={errors.newPassword}
        hint={t("resetHint")}
        onChange={setPassword}
      />
      <ErrorMessage message={formError} className="text-sm text-rose-deep" />
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? t("updating") : t("updatePassword")}
      </Button>
      <p className="text-sm text-muted">
        <Link href="/login" className={authLinkClass()}>
          {t("backToLogin")}
        </Link>
      </p>
    </form>
  );
}
