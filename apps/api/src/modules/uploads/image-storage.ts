import { randomUUID } from "node:crypto";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { AppError } from "../../common/errors/app-error.js";
import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { detectImage, MAX_IMAGE_BYTES, type ImageKind } from "./image-file.js";

const EXTENSIONS = ["jpg", "png", "webp"] as const;

/** UUID v4 plus an extension we generated. Not a client filename. */
const CATALOG_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/** One stable name per user: `{userId}.{ext}`. */
const AVATAR_NAME = /^[1-9]\d{0,9}\.(jpg|png|webp)$/;

export type MediaScope = "catalog" | "avatars";

export type PreparedAvatar = {
  url: string;
  commit: () => Promise<void>;
  abort: () => Promise<void>;
};

function requireImage(bytes: Buffer): ImageKind {
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw AppError.badRequest("Image must be 5 MB or smaller.");
  }
  const kind = detectImage(bytes);
  if (!kind) {
    throw AppError.badRequest("Image must be a JPEG, PNG, or WebP file.");
  }
  return kind;
}

function publicUrl(env: Env, scope: MediaScope, filename: string): string {
  return `${env.API_PUBLIC_URL}/api/v1/media/${scope}/${filename}`;
}

export function resolveManagedFile(
  env: Env,
  scope: MediaScope,
  filename: string,
): string | null {
  const pattern = scope === "catalog" ? CATALOG_NAME : AVATAR_NAME;
  if (!pattern.test(filename)) {
    return null;
  }

  const root = path.resolve(env.UPLOAD_DIR, scope);
  const full = path.resolve(root, filename);
  if (full !== path.join(root, filename)) {
    return null;
  }
  return full;
}

export function parseManagedImageUrl(
  env: Env,
  url: string,
): { scope: MediaScope; filename: string; fullPath: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const base = new URL(env.API_PUBLIC_URL);
  if (parsed.origin !== base.origin) {
    return null;
  }

  const prefix = "/api/v1/media/";
  if (!parsed.pathname.startsWith(prefix)) {
    return null;
  }

  const rest = parsed.pathname.slice(prefix.length);
  const slash = rest.indexOf("/");
  if (slash <= 0 || rest.includes("/", slash + 1)) {
    return null;
  }

  const scope = rest.slice(0, slash);
  const filename = rest.slice(slash + 1);
  if (scope !== "catalog" && scope !== "avatars") {
    return null;
  }

  const fullPath = resolveManagedFile(env, scope, filename);
  if (!fullPath) {
    return null;
  }

  return { scope, filename, fullPath };
}

export async function storeCatalogImage(
  env: Env,
  bytes: Buffer,
): Promise<string> {
  const kind = requireImage(bytes);
  const filename = `${randomUUID()}.${kind.ext}`;
  const dir = path.resolve(env.UPLOAD_DIR, "catalog");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes, { flag: "wx" });
  return publicUrl(env, "catalog", filename);
}

/**
 * Stage a replacement avatar without touching the live file.
 * Call `commit` only after `avatarUrl` is saved. Call `abort` if that save fails.
 */
export async function prepareAvatarFile(
  env: Env,
  userId: number,
  bytes: Buffer,
): Promise<PreparedAvatar> {
  if (!Number.isInteger(userId) || userId < 1) {
    throw AppError.badRequest("Could not save the profile image.");
  }

  const kind = requireImage(bytes);
  const filename = `${userId}.${kind.ext}`;
  const dir = path.resolve(env.UPLOAD_DIR, "avatars");
  await mkdir(dir, { recursive: true });
  const finalPath = path.join(dir, filename);
  const partialPath = path.join(dir, `.${userId}.${randomUUID()}.partial`);
  await writeFile(partialPath, bytes, { flag: "wx" });

  return {
    url: publicUrl(env, "avatars", filename),
    async commit() {
      await moveIntoPlace(partialPath, finalPath);
      await Promise.all(
        EXTENSIONS.filter((ext) => ext !== kind.ext).map(async (ext) => {
          try {
            await rm(path.join(dir, `${userId}.${ext}`), { force: true });
          } catch {
            // The new avatar is already the file the profile points at.
          }
        }),
      );
    },
    async abort() {
      await rm(partialPath, { force: true });
    },
  };
}

async function moveIntoPlace(partialPath: string, finalPath: string): Promise<void> {
  try {
    await rename(partialPath, finalPath);
  } catch (error) {
    const code =
      error instanceof Error && "code" in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
    if (code !== "EEXIST" && code !== "EPERM") {
      throw error;
    }
    await rm(finalPath, { force: true });
    await rename(partialPath, finalPath);
  }
}

/**
 * Delete a file this API stored, after the database no longer references it.
 * External http(s) URLs are left untouched. Disk errors do not fail the request
 * that already saved the new URL.
 */
export async function releaseUnusedImage(
  env: Env,
  prisma: Database,
  url: string | null | undefined,
): Promise<void> {
  if (!url) {
    return;
  }

  const managed = parseManagedImageUrl(env, url);
  if (!managed) {
    return;
  }

  const [products, categories, profiles] = await Promise.all([
    prisma.productImage.count({ where: { url } }),
    prisma.category.count({ where: { imageUrl: url } }),
    prisma.userProfile.count({ where: { avatarUrl: url } }),
  ]);

  if (products + categories + profiles > 0) {
    return;
  }

  try {
    await rm(managed.fullPath, { force: true });
  } catch {
    // The row no longer points here. A later unused-file pass can retry.
  }
}
