"use client";

import { useTranslations } from "next-intl";
import { KnownText } from "@/components/i18n/known-text";
import { useRouter } from "@/i18n/navigation";
import { useState, type FormEvent } from "react";
import { PasswordField } from "@/components/auth/fields";
import { postAuth } from "@/components/auth/post-auth";
import { Button } from "@/components/ui/button";
import { MESSAGES } from "@/lib/auth/credentials";
import {
  isWrongCurrentPassword,
  validatePasswordChange,
  type PasswordChangeErrors,
} from "@/lib/auth/password-change";

export function ChangePasswordForm() {
  const router = useRouter();
  const t = useTranslations("account");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<PasswordChangeErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    const parsed = validatePasswordChange({
      currentPassword,
      newPassword,
      confirmPassword,
    });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      return;
    }

    setErrors({});
    setPending(true);
    const result = await postAuth("/api/account/change-password", parsed.value);
    setPending(false);

    if (result.ok) {
      router.push("/login?notice=password-changed");
      router.refresh();
      return;
    }

    if (result.status === 401 && !isWrongCurrentPassword(result.message)) {
      router.push("/login?next=%2Faccount%2Fchange-password&expired=1");
      router.refresh();
      return;
    }

    setFormError(result.message || MESSAGES.unavailable);
  }

  return (
    <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-5">
      {formError ? (
        <p role="alert" className="text-sm text-rose-deep">
          <KnownText value={formError} />
        </p>
      ) : null}
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
