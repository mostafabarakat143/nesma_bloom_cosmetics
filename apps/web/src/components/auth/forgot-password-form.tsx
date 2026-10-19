"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { authLinkClass } from "@/components/auth/auth-shell";
import { TextField } from "@/components/auth/fields";
import { postAuth } from "@/components/auth/post-auth";
import { KnownText } from "@/components/i18n/known-text";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { MESSAGES, validateForgot, type FieldErrors } from "@/lib/auth/credentials";

export function ForgotPasswordForm() {
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateForgot({ email });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setFormError(null);
      setSuccess(null);
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);
    const result = await postAuth("/api/auth/forgot-password", parsed.value);
    setPending(false);

    if (!result.ok) {
      setSuccess(null);
      setFormError(result.message);
      return;
    }

    setSuccess(
      typeof result.data.message === "string" ? result.data.message : MESSAGES.forgot,
    );
  }

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
      {formError ? (
        <p role="alert" className="text-sm text-rose-deep">
          <KnownText value={formError} />
        </p>
      ) : null}
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
