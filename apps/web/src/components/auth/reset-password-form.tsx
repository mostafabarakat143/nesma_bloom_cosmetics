"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { authLinkClass } from "@/components/auth/auth-shell";
import { PasswordField } from "@/components/auth/fields";
import { postAuth } from "@/components/auth/post-auth";
import { useResetToken } from "@/components/auth/reset-token";
import { Button } from "@/components/ui/button";
import {
  MESSAGES,
  validateNewPassword,
  type FieldErrors,
} from "@/lib/auth/credentials";

export function ResetPasswordForm() {
  const token = useResetToken();
  const router = useRouter();
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
          {MESSAGES.resetInvalid}
        </p>
        <p className="text-sm text-muted">
          <Link href="/forgot-password" className={authLinkClass()}>
            Request a new reset link
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} className="space-y-5" noValidate>
      <PasswordField
        id="reset-password"
        label="New password"
        autoComplete="new-password"
        value={password}
        error={errors.newPassword}
        hint="Use at least 8 characters. This link works once."
        onChange={setPassword}
      />
      {formError ? (
        <p role="alert" className="text-sm text-rose-deep">
          {formError}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Updating password" : "Update password"}
      </Button>
      <p className="text-sm text-muted">
        <Link href="/login" className={authLinkClass()}>
          Back to log in
        </Link>
      </p>
    </form>
  );
}
