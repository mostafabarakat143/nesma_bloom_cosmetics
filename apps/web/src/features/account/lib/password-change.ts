import { createValidation } from "@/shared/validation";

const defaultValidation = createValidation();

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

export function isWrongCurrentPassword(message: string): boolean {
  return message === defaultValidation.message("wrongCurrent");
}
export function validatePasswordChange(input: { currentPassword: string; newPassword: string; confirmPassword: string }) {
  return defaultValidation.parse(defaultValidation.auth.changePassword(), input);
}
export function validatePasswordChangeBody(body: unknown) {
  const parsed = defaultValidation.auth.changePasswordRequest().safeParse(body);
  return parsed.success ? { ok: true as const, value: parsed.data }
    : { ok: false as const, message: parsed.error.issues[0]?.message ?? defaultValidation.message("currentRequired") };
}
