import { createValidation } from "@/shared/validation";

import { isRecord } from "@/shared/lib/guards";

const defaultValidation = createValidation();
const ID_MAX = 2_147_483_647;
const NAME_MAX = 100;
const PHONE_MAX = 30;

export type AccountProfile = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
};

export function optionalProfileName(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > NAME_MAX) {
    return null;
  }
  return trimmed;
}

export function optionalProfilePhone(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.length > PHONE_MAX) {
    return null;
  }
  return trimmed;
}

export function parseAvatarUrl(value: unknown): string | null {
  const parsed = defaultValidation.account.avatarUrl().safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function parseAccountProfile(value: unknown): AccountProfile | null {
  if (!isRecord(value)) {
    return null;
  }
  const userId = value.userId;
  if (
    typeof userId !== "number" ||
    !Number.isInteger(userId) ||
    userId < 1 ||
    userId > ID_MAX ||
    typeof value.email !== "string" ||
    value.email.trim() === ""
  ) {
    return null;
  }
  return {
    email: value.email.trim(),
    firstName: optionalProfileName(value.firstName),
    lastName: optionalProfileName(value.lastName),
    phone: optionalProfilePhone(value.phone),
    avatarUrl: parseAvatarUrl(value.avatarUrl),
  };
}

export function parseSavedProfile(value: unknown): AccountProfile | null {
  if (!isRecord(value) || typeof value.email !== "string" || value.email.trim() === "") {
    return null;
  }
  return {
    email: value.email.trim(),
    firstName: optionalProfileName(value.firstName),
    lastName: optionalProfileName(value.lastName),
    phone: optionalProfilePhone(value.phone),
    avatarUrl: parseAvatarUrl(value.avatarUrl),
  };
}
