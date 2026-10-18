import { parseAvatarUrl } from "./profile-parse";

const NAME_MAX = 100;
const PHONE_MIN = 3;
const PHONE_MAX = 30;
const AVATAR_MAX = 2048;

const ALLOWED_FIELDS = ["firstName", "lastName", "phone", "avatarUrl"] as const;

export type ProfileField = (typeof ALLOWED_FIELDS)[number];

export type ProfileFieldErrors = Partial<Record<ProfileField | "form", string>>;

export type ProfileUpdate = Partial<{
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
}>;

export const PROFILE_MESSAGES = {
  firstName: "First name must be 100 characters or fewer.",
  lastName: "Last name must be 100 characters or fewer.",
  phone: "Phone number must be between 3 and 30 characters.",
  avatar: "Enter an http or https image address, up to 2048 characters.",
  required: "At least one profile field is required.",
  unsupported: "That profile field cannot be changed.",
  saved: "Profile saved.",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clearedOrText(
  value: unknown,
  tooLong: string,
  max: number,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value === null) {
    return { ok: true, value: null };
  }
  if (typeof value !== "string") {
    return { ok: false, error: tooLong };
  }
  const trimmed = value.trim();
  if (trimmed === "") {
    return { ok: true, value: null };
  }
  if (trimmed.length > max) {
    return { ok: false, error: tooLong };
  }
  return { ok: true, value: trimmed };
}

export function profileUpdateError(errors: ProfileFieldErrors): string {
  return (
    errors.form ??
    errors.firstName ??
    errors.lastName ??
    errors.phone ??
    errors.avatarUrl ??
    "Validation failed."
  );
}

/**
 * Mirrors the Express profile schema: names 1–100, phone 3–30, avatar URL up to 2048.
 * A blank field is stored as null. Only http(s) avatar URLs are accepted.
 * Email, role, and any other field are rejected.
 */
export function validateProfileUpdate(
  body: unknown,
): { ok: true; value: ProfileUpdate } | { ok: false; errors: ProfileFieldErrors } {
  if (!isRecord(body)) {
    return { ok: false, errors: { form: PROFILE_MESSAGES.required } };
  }

  const unknown = Object.keys(body).filter(
    (key) => !ALLOWED_FIELDS.includes(key as ProfileField),
  );
  if (unknown.length > 0) {
    return { ok: false, errors: { form: PROFILE_MESSAGES.unsupported } };
  }
  if (Object.keys(body).length === 0) {
    return { ok: false, errors: { form: PROFILE_MESSAGES.required } };
  }

  const errors: ProfileFieldErrors = {};
  const value: Partial<ProfileUpdate> = {};

  if ("firstName" in body) {
    const parsed = clearedOrText(body.firstName, PROFILE_MESSAGES.firstName, NAME_MAX);
    if (!parsed.ok) errors.firstName = parsed.error;
    else value.firstName = parsed.value;
  }
  if ("lastName" in body) {
    const parsed = clearedOrText(body.lastName, PROFILE_MESSAGES.lastName, NAME_MAX);
    if (!parsed.ok) errors.lastName = parsed.error;
    else value.lastName = parsed.value;
  }
  if ("phone" in body) {
    const parsed = clearedOrText(body.phone, PROFILE_MESSAGES.phone, PHONE_MAX);
    if (!parsed.ok) {
      errors.phone = parsed.error;
    } else if (parsed.value !== null && parsed.value.length < PHONE_MIN) {
      errors.phone = PROFILE_MESSAGES.phone;
    } else {
      value.phone = parsed.value;
    }
  }
  if ("avatarUrl" in body) {
    if (body.avatarUrl === null || (typeof body.avatarUrl === "string" && body.avatarUrl.trim() === "")) {
      value.avatarUrl = null;
    } else if (typeof body.avatarUrl !== "string" || body.avatarUrl.trim().length > AVATAR_MAX) {
      errors.avatarUrl = PROFILE_MESSAGES.avatar;
    } else {
      const avatar = parseAvatarUrl(body.avatarUrl);
      if (!avatar) errors.avatarUrl = PROFILE_MESSAGES.avatar;
      else value.avatarUrl = avatar;
    }
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, value };
}
