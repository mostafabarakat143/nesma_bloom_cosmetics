"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { authLinkClass } from "@/components/auth/auth-shell";
import { PasswordField, TextField } from "@/components/auth/fields";
import { postAuth } from "@/components/auth/post-auth";
import { Button } from "@/components/ui/button";
import { validateRegister, type FieldErrors } from "@/lib/auth/credentials";
import { safeNextPath } from "@/lib/auth/redirect";

export function RegisterForm({ nextPath }: { nextPath: string }) {
  const router = useRouter();
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

    router.push(safeNextPath(result.data.redirectTo));
    router.refresh();
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-5" noValidate>
      <TextField
        id="register-first-name"
        label="First name"
        autoComplete="given-name"
        placeholder="Your first name"
        value={firstName}
        error={errors.firstName}
        maxLength={100}
        onChange={setFirstName}
      />
      <TextField
        id="register-last-name"
        label="Last name"
        autoComplete="family-name"
        placeholder="Your last name"
        value={lastName}
        error={errors.lastName}
        maxLength={100}
        onChange={setLastName}
      />
      <TextField
        id="register-email"
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
        id="register-password"
        label="Password"
        autoComplete="new-password"
        placeholder="Enter your password"
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
        {pending ? "Creating account" : "Create account"}
      </Button>
      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link href={loginHref} className={authLinkClass()}>
          Log in
        </Link>
      </p>
    </form>
  );
}
