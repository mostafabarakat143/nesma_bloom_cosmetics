import { createValidation } from "@/shared/validation";
import { isRecord } from "@/shared/lib/guards";

const defaultValidation = createValidation();

const EMAIL_MAX = defaultValidation.limits.email;
const ID_MAX = defaultValidation.limits.id;
export type FieldErrors = Partial<
  Record<"email" | "password" | "firstName" | "lastName" | "newPassword", string>
>;

export type LoginInput = {
  email: string;
  password: string;
};

export type RegisterInput = LoginInput & {
  firstName?: string;
  lastName?: string;
};

export type PublicUser = {
  id: number;
  email: string;
  role: "CUSTOMER" | "ADMIN";
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
  updatedAt: string;
};

export function validateLogin(body: unknown) {
  return defaultValidation.parse(defaultValidation.auth.login(), body);
}
export function validateRegister(body: unknown) {
  return defaultValidation.parse(defaultValidation.auth.register(), body);
}
export function validateForgot(body: unknown) {
  return defaultValidation.parse(defaultValidation.auth.forgotPassword(), body);
}
export function validateNewPassword(body: unknown) {
  const parsed = defaultValidation.parse(defaultValidation.auth.resetPassword(), body);
  return parsed.ok ? { ok: true as const, value: parsed.value.newPassword } : parsed;
}
export function firstError(errors: FieldErrors): string {
  return errors.email ?? errors.password ?? errors.newPassword ?? errors.firstName ?? errors.lastName ?? defaultValidation.message("validationFailed");
}
export function isUsableResetToken(token: string): boolean {
  return defaultValidation.auth.resetToken().safeParse(token).success;
}

function integerId(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }
  if (value < 1 || value > ID_MAX) {
    return null;
  }
  return value;
}

export function parsePublicUser(value: unknown): PublicUser | null {
  if (!isRecord(value)) {
    return null;
  }
  const id = integerId(value.id);
  if (
    id === null ||
    typeof value.email !== "string" ||
    value.email.length === 0 ||
    value.email.length > EMAIL_MAX ||
    (value.role !== "CUSTOMER" && value.role !== "ADMIN") ||
    (value.status !== "ACTIVE" && value.status !== "DISABLED") ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string"
  ) {
    return null;
  }
  return {
    id,
    email: value.email,
    role: value.role,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}
