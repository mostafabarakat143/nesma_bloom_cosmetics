"use client";

import { useRouter } from "next/navigation";
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
          {formError}
        </p>
      ) : null}
      <PasswordField
        id="current-password"
        label="Current password"
        autoComplete="current-password"
        value={currentPassword}
        error={errors.currentPassword}
        onChange={setCurrentPassword}
      />
      <PasswordField
        id="new-password"
        label="New password"
        autoComplete="new-password"
        value={newPassword}
        error={errors.newPassword}
        hint="At least 8 characters."
        onChange={setNewPassword}
      />
      <PasswordField
        id="confirm-password"
        label="Confirm new password"
        autoComplete="new-password"
        value={confirmPassword}
        error={errors.confirmPassword}
        onChange={setConfirmPassword}
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Changing password" : "Change password"}
        </Button>
        <Button href="/account" variant="secondary">
          Cancel
        </Button>
      </div>
    </form>
  );
}
