export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

export const AVATAR_FILE_MESSAGES = {
  type: "Image must be a JPEG, PNG, or WebP file.",
  size: "Image must be 5 MB or smaller.",
  missing: "Choose an image file.",
} as const;

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function avatarFileError(file: {
  size: number;
  type: string;
  name: string;
}): string | null {
  if (file.size <= 0) {
    return AVATAR_FILE_MESSAGES.missing;
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return AVATAR_FILE_MESSAGES.size;
  }
  const type = file.type.toLowerCase();
  if (ALLOWED_TYPES.has(type)) {
    return null;
  }
  if (type === "" && /\.(jpe?g|png|webp)$/i.test(file.name)) {
    return null;
  }
  return AVATAR_FILE_MESSAGES.type;
}
