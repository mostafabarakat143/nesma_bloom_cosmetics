import { createValidation, type AvatarFileInput } from "@/shared/validation";

const defaultValidation = createValidation();
export const AVATAR_FILE_MESSAGES = defaultValidation.avatarMessages;
export const AVATAR_MAX_BYTES = defaultValidation.limits.avatarBytes;

export function avatarFileError(file: AvatarFileInput): string | null {
  const parsed = defaultValidation.account.avatarFile().safeParse(file);
  return parsed.success ? null : parsed.error.issues[0]?.message ?? defaultValidation.message("profilePhotoMissing");
}
