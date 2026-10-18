const EMAIL_MAX = 255;
const PASSWORD_MAX = 128;
const NAME_MAX = 100;
const ID_MAX = 2_147_483_647;

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

export const MESSAGES = {
  emailRequired: "Email is required.",
  emailInvalid: "Please enter a valid email address.",
  emailTooLong: "Email is invalid.",
  passwordRequired: "Password is required.",
  passwordShort: "Password must be at least 8 characters.",
  passwordTooLong: "Password is invalid.",
  firstNameInvalid: "First name is invalid.",
  lastNameInvalid: "Last name is invalid.",
  resetInvalid: "This reset link is invalid or has expired.",
  malformed: "Malformed JSON in request body.",
  rejected: "This request was rejected.",
  unavailable: "We could not reach the account service. Please try again.",
  sessionEnded: "Your session has ended.",
  loggedOut: "Logged out",
  revokeUnconfirmed:
    "Your session on this browser has ended. The account service could not confirm that the token was revoked. A copied token may remain valid until it expires.",
  resetSuccess: "Password has been reset. Please log in.",
  passwordChanged: "Password changed. Please log in again.",
  forgot:
    "If an account exists for that email, password reset instructions have been sent.",
  duplicate: "An account with this email already exists. Please log in.",
  loginFailed: "Invalid email or password.",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function emailError(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return MESSAGES.emailRequired;
  }
  const email = normalizeEmail(value);
  if (email.length > EMAIL_MAX) {
    return MESSAGES.emailTooLong;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return MESSAGES.emailInvalid;
  }
  return null;
}

function loginPasswordError(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return MESSAGES.passwordRequired;
  }
  if (value.length > PASSWORD_MAX) {
    return MESSAGES.passwordTooLong;
  }
  return null;
}

function newPasswordError(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return MESSAGES.passwordRequired;
  }
  if (value.length < 8) {
    return MESSAGES.passwordShort;
  }
  if (value.length > PASSWORD_MAX) {
    return MESSAGES.passwordTooLong;
  }
  return null;
}

function nameError(
  value: unknown,
  invalidMessage: string,
): { error: string } | { value: string | undefined } {
  if (value === undefined || value === null) {
    return { value: undefined };
  }
  if (typeof value !== "string") {
    return { error: invalidMessage };
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return { value: undefined };
  }
  if (trimmed.length > NAME_MAX) {
    return { error: invalidMessage };
  }
  return { value: trimmed };
}

export function validateLogin(
  body: unknown,
): { ok: true; value: LoginInput } | { ok: false; errors: FieldErrors } {
  const record = isRecord(body) ? body : {};
  const errors: FieldErrors = {};
  const email = emailError(record.email);
  const password = loginPasswordError(record.password);
  if (email) errors.email = email;
  if (password) errors.password = password;
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      email: normalizeEmail(String(record.email)),
      password: String(record.password),
    },
  };
}

export function validateRegister(
  body: unknown,
): { ok: true; value: RegisterInput } | { ok: false; errors: FieldErrors } {
  const record = isRecord(body) ? body : {};
  const errors: FieldErrors = {};
  const email = emailError(record.email);
  const password = newPasswordError(record.password);
  if (email) errors.email = email;
  if (password) errors.password = password;

  const firstName = nameError(record.firstName, MESSAGES.firstNameInvalid);
  const lastName = nameError(record.lastName, MESSAGES.lastNameInvalid);
  if ("error" in firstName) errors.firstName = firstName.error;
  if ("error" in lastName) errors.lastName = lastName.error;

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    value: {
      email: normalizeEmail(String(record.email)),
      password: String(record.password),
      ...("value" in firstName && firstName.value
        ? { firstName: firstName.value }
        : {}),
      ...("value" in lastName && lastName.value ? { lastName: lastName.value } : {}),
    },
  };
}

export function validateForgot(
  body: unknown,
): { ok: true; value: { email: string } } | { ok: false; errors: FieldErrors } {
  const record = isRecord(body) ? body : {};
  const email = emailError(record.email);
  if (email) {
    return { ok: false, errors: { email } };
  }
  return { ok: true, value: { email: normalizeEmail(String(record.email)) } };
}

export function validateNewPassword(
  body: unknown,
): { ok: true; value: string } | { ok: false; errors: FieldErrors } {
  const record = isRecord(body) ? body : {};
  const password = newPasswordError(record.newPassword);
  if (password) {
    return { ok: false, errors: { newPassword: password } };
  }
  return { ok: true, value: String(record.newPassword) };
}

export function firstError(errors: FieldErrors): string {
  return (
    errors.email ??
    errors.password ??
    errors.newPassword ??
    errors.firstName ??
    errors.lastName ??
    "Validation failed."
  );
}

export function isUsableResetToken(token: string): boolean {
  return token.length >= 20 && token.length <= 200 && !/[\r\n]/.test(token);
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
