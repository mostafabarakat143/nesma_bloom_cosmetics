"use client";

import { useTranslations } from "next-intl";
import { useState, type FormEvent } from "react";

import { authLinkClass } from "@/components/auth/auth-shell";
import { PasswordField, TextField } from "@/components/auth/fields";
import { postAuth } from "@/components/auth/post-auth";
import { KnownText } from "@/components/i18n/known-text";
import { Button } from "@/components/ui/button";
import { Link, useRouter } from "@/i18n/navigation";
import { splitLocaleHref } from "@/i18n/pathname";
import {
  MESSAGES,
  validateLogin,
  type FieldErrors,
} from "@/lib/auth/credentials";
import { safeNextPath } from "@/lib/auth/redirect";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const t = useTranslations("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const registerHref =
    nextPath === "/shop" ? "/register" : `/register?next=${encodeURIComponent(nextPath)}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateLogin({ email, password });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setFormError(null);
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);
    const result = await postAuth("/api/auth/login", {
      email: parsed.value.email,
      password: parsed.value.password,
      next: nextPath,
    });
    setPending(false);

    if (!result.ok) {
      setFormError(result.message || MESSAGES.loginFailed);
      return;
    }

    const destination = splitLocaleHref(safeNextPath(result.data.redirectTo));
    router.push(destination.href, destination.locale ? { locale: destination.locale } : undefined);
    router.refresh();
  }

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
      {formError ? (
        <p role="alert" className="text-sm text-rose-deep">
          <KnownText value={formError} />
        </p>
      ) : null}
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
