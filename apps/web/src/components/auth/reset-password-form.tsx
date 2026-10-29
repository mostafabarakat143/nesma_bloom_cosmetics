"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";
import { authLinkClass } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/fields";
import { postAuth } from "@/components/auth/post-auth";
import { useResetToken } from "@/components/auth/reset-token";
import { KnownText } from "@/components/i18n/known-text";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import {
  MESSAGES,
  validateNewPassword,
  type FieldErrors,
} from "@/lib/auth/credentials";

export function ResetPasswordForm() {
  const token = useResetToken();
  const router = useRouter();
  const t = useTranslations("auth");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setFormError(MESSAGES.resetInvalid);
      return;
    }

    const parsed = validateNewPassword({ newPassword: password });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setFormError(null);
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);
    const result = await postAuth("/api/auth/reset-password", {
      token,
      newPassword: parsed.value,
    });
    setPending(false);

    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    router.push("/login?notice=reset");
    router.refresh();
  }

  if (!token) {
    return (
      <div className="space-y-5">
        <p role="alert" className="text-sm leading-relaxed text-rose-deep">
          <KnownText value={MESSAGES.resetInvalid} />
        </p>
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
      {formError ? (
        <p role="alert" className="text-sm text-rose-deep">
          <KnownText value={formError} />
        </p>
      ) : null}
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
