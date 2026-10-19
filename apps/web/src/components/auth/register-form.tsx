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
import { validateRegister, type FieldErrors } from "@/lib/auth/credentials";
import { safeNextPath } from "@/lib/auth/redirect";

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const t = useTranslations("auth");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const loginHref =
    nextPath === "/shop" ? "/login" : `/login?next=${encodeURIComponent(nextPath)}`;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateRegister({ email, password, firstName, lastName });
    if (!parsed.ok) {
      setErrors(parsed.errors);
      setFormError(null);
      return;
    }

    setErrors({});
    setFormError(null);
    setPending(true);
    const result = await postAuth("/api/auth/register", {
      ...parsed.value,
      next: nextPath,
    });
    setPending(false);

    if (!result.ok) {
      setFormError(result.message);
      return;
    }

    const destination = splitLocaleHref(safeNextPath(result.data.redirectTo));
    router.push(destination.href, destination.locale ? { locale: destination.locale } : undefined);
    router.refresh();
  }

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
      {formError ? (
        <p role="alert" className="text-sm text-rose-deep">
          <KnownText value={formError} />
        </p>
      ) : null}
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
