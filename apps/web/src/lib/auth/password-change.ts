import { MESSAGES } from "@/lib/auth/credentials";

export type PasswordChangeErrors = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  form?: string;
};

export type PasswordChangeValue = {
  currentPassword: string;
  newPassword: string;
};

const WRONG_CURRENT = "Current password is incorrect.";

export function isWrongCurrentPassword(message: string): boolean {
  return message === WRONG_CURRENT;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function validatePasswordChange(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): { ok: true; value: PasswordChangeValue } | { ok: false; errors: PasswordChangeErrors } {
  const errors: PasswordChangeErrors = {};
  const currentPassword = input.currentPassword;
  const newPassword = input.newPassword;

  if (currentPassword.length === 0) {
    errors.currentPassword = "Current password is required.";
  } else if (currentPassword.length > 128) {
    errors.currentPassword = MESSAGES.passwordTooLong;
  }

  if (newPassword.length === 0) {
    errors.newPassword = "New password is required.";
  } else if (newPassword.length < 8) {
    errors.newPassword = MESSAGES.passwordShort;
  } else if (newPassword.length > 128) {
    errors.newPassword = MESSAGES.passwordTooLong;
  }

  if (input.confirmPassword !== newPassword) {
    errors.confirmPassword = "New passwords do not match.";
  }

  if (
    !errors.currentPassword &&
    !errors.newPassword &&
    currentPassword === newPassword
  ) {
    errors.newPassword = "New password must be different from the current password.";
  }

  if (errors.currentPassword || errors.newPassword || errors.confirmPassword) {
    return { ok: false, errors };
  }

  return { ok: true, value: { currentPassword, newPassword } };
}

export function validatePasswordChangeBody(
  body: unknown,
): { ok: true; value: PasswordChangeValue } | { ok: false; message: string } {
  if (!isRecord(body)) {
    return { ok: false, message: MESSAGES.malformed };
  }

  const keys = Object.keys(body);
  if (keys.some((key) => key !== "currentPassword" && key !== "newPassword")) {
    return { ok: false, message: "Only the current and new password can be submitted." };
  }
  if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
    return { ok: false, message: "Current password is required." };
  }

  const parsed = validatePasswordChange({
    currentPassword: body.currentPassword,
    newPassword: body.newPassword,
    confirmPassword: body.newPassword,
  });
  if (!parsed.ok) {
    return {
      ok: false,
      message:
        parsed.errors.currentPassword ??
        parsed.errors.newPassword ??
        "Current password is required.",
    };
  }
  return { ok: true, value: parsed.value };
}
