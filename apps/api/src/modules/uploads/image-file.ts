/** Largest accepted upload. Checked again after the multipart parser. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export type ImageKind = {
  ext: "jpg" | "png" | "webp";
  contentType: "image/jpeg" | "image/png" | "image/webp";
};

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/**
 * Identify JPEG, PNG, or WebP from the file header.
 * The client-supplied extension and Content-Type are ignored.
 * SVG and other types return null.
 */
export function detectImage(bytes: Buffer): ImageKind | null {
  if (bytes.length < 12) {
    return null;
  }

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }

  if (bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return { ext: "png", contentType: "image/png" };
  }

  if (
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return { ext: "webp", contentType: "image/webp" };
  }

  return null;
}
