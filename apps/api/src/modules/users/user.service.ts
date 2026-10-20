import { AppError } from "../../common/errors/app-error.js";
import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import {
  toPublicProfile,
  type PublicProfileDto,
} from "../auth/auth.mapper.js";
import {
  prepareAvatarFile,
  releaseUnusedImage,
} from "../uploads/image-storage.js";
import type { UpdateProfileBody, UpdateUserBody, ListUsersQuery } from "./user.schema.js";
import {
  findUserForAdmin,
  findUsersPage,
  LastAdminError,
  updateUserForAdmin,
  type AdminUserRecord,
} from "./user.repository.js";

export async function getOwnProfile(
  prisma: Database,
  userId: number,
): Promise<PublicProfileDto> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  });
  if (!profile) {
    throw AppError.notFound("Profile not found");
  }
  return toPublicProfile(profile, profile.user.email);
}

export async function updateOwnProfile(
  prisma: Database,
  userId: number,
  input: UpdateProfileBody,
  env: Env,
): Promise<PublicProfileDto> {
  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  if (!existing) {
    throw AppError.notFound("Profile not found");
  }

  const previousUrl = existing.avatarUrl;

  const profile = await prisma.userProfile.update({
    where: { userId },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    },
    include: { user: { select: { email: true } } },
  });

  if (
    input.avatarUrl !== undefined &&
    previousUrl &&
    previousUrl !== input.avatarUrl
  ) {
    await releaseUnusedImage(env, prisma, previousUrl);
  }

  return toPublicProfile(profile, profile.user.email);
}

/** Replace the single profile image for this user. The previous file is removed. */
export async function replaceOwnAvatar(
  env: Env,
  prisma: Database,
  userId: number,
  bytes: Buffer,
): Promise<PublicProfileDto> {
  const existing = await prisma.userProfile.findUnique({
    where: { userId },
    include: { user: { select: { email: true } } },
  });
  if (!existing) {
    throw AppError.notFound("Profile not found");
  }

  const prepared = await prepareAvatarFile(env, userId, bytes);
  let profile;
  try {
    profile = await prisma.userProfile.update({
      where: { userId },
      data: { avatarUrl: prepared.url },
      include: { user: { select: { email: true } } },
    });
  } catch (error) {
    await prepared.abort();
    throw error;
  }

  try {
    await prepared.commit();
  } catch (error) {
    await prisma.userProfile.update({
      where: { userId },
      data: { avatarUrl: existing.avatarUrl },
    });
    await prepared.abort();
    throw error;
  }

  if (existing.avatarUrl && existing.avatarUrl !== prepared.url) {
    await releaseUnusedImage(env, prisma, existing.avatarUrl);
  }

  return toPublicProfile(profile, profile.user.email);
}

export type AdminUserDto = {
  id: number;
  email: string;
  role: AdminUserRecord["role"];
  status: AdminUserRecord["status"];
  createdAt: string;
  updatedAt: string;
  profile: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    avatarUrl: string | null;
  } | null;
};

function toAdminUserDto(user: AdminUserRecord): AdminUserDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
    profile: user.profile,
  };
}

export async function listUsers(
  prisma: Database,
  query: ListUsersQuery,
): Promise<{
  items: AdminUserDto[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}> {
  const { items, totalItems } = await findUsersPage(prisma, query);
  const totalPages =
    totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

  return {
    items: items.map(toAdminUserDto),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function getUserById(
  prisma: Database,
  id: number,
): Promise<AdminUserDto> {
  const user = await findUserForAdmin(prisma, id);
  if (!user) {
    throw AppError.notFound("User not found");
  }
  return toAdminUserDto(user);
}

export async function updateUser(
  prisma: Database,
  id: number,
  input: UpdateUserBody,
): Promise<AdminUserDto> {
  try {
    const user = await updateUserForAdmin(prisma, id, input);
    if (!user) {
      throw AppError.notFound("User not found");
    }
    return toAdminUserDto(user);
  } catch (error) {
    if (error instanceof LastAdminError) {
      throw AppError.conflict("Cannot remove the last active admin");
    }
    throw error;
  }
}
