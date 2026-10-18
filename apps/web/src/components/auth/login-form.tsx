"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { authLinkClass } from "@/components/auth/auth-shell";
import { PasswordField, TextField } from "@/components/auth/fields";
import { postAuth } from "@/components/auth/post-auth";
import { Button } from "@/components/ui/button";
import {
  MESSAGES,
  validateLogin,
  type FieldErrors,
} from "@/lib/auth/credentials";
import { safeNextPath } from "@/lib/auth/redirect";

export function LoginForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
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

    router.push(safeNextPath(result.data.redirectTo));
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-5" noValidate>
      <TextField
        id="login-email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        error={errors.email}
        maxLength={255}
        onChange={setEmail}
      />
      <PasswordField
        id="login-password"
        label="Password"
        autoComplete="current-password"
        placeholder="Your password"
        value={password}
        error={errors.password}
        onChange={setPassword}
      />
      {formError ? (
        <p role="alert" className="text-sm text-rose-deep">
          {formError}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Logging in" : "Log in"}
      </Button>
      <p className="text-sm text-muted">
        <Link href="/forgot-password" className={authLinkClass()}>
          Forgot your password?
        </Link>
      </p>
      <p className="text-sm text-muted">
        New to Lamsa?{" "}
        <Link href={registerHref} className={authLinkClass()}>
          Create an account
        </Link>
      </p>
    </form>
  );
}
