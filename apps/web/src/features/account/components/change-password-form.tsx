"use client";

import { createValidation } from "@/shared/validation";

import { ErrorMessage } from "@/components/ui/error-message";

import { useTranslations } from "next-intl";

import { useChangePasswordForm } from "@/features/account/hooks/use-change-password-form";

import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/fields";

export function ChangePasswordForm() {
  const validationT = useTranslations("validation");
  const validation = createValidation(validationT);
  const schema = validation.auth.changePassword();
  const {
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
  } = useChangePasswordForm(schema);

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-5">
      <ErrorMessage message={formError} className="text-sm text-rose-deep" />
      <PasswordField
        id="current-password"
        label={t("currentPassword")}
        placeholder={t("currentPasswordPlaceholder")}
        autoComplete="current-password"
        value={currentPassword}
        error={errors.currentPassword}
        onChange={setCurrentPassword}
      />
      <PasswordField
        id="new-password"
        label={t("newPassword")}
        placeholder={t("newPasswordPlaceholder")}
        autoComplete="new-password"
        value={newPassword}
        error={errors.newPassword}
        onChange={setNewPassword}
      />
      <PasswordField
        id="confirm-password"
        label={t("confirmPassword")}
        placeholder={t("confirmPasswordPlaceholder")}
        autoComplete="new-password"
        value={confirmPassword}
        error={errors.confirmPassword}
        onChange={setConfirmPassword}
      />
      <div className="flex flex-wrap justify-end gap-3">
        <Button href="/account" variant="secondary">
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? t("changing") : t("changePassword")}
        </Button>
      </div>
    </form>
  );
}
