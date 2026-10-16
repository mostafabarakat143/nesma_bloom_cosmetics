import { AppError } from "../../common/errors/app-error.js";
import type { Database } from "../../config/database.js";
import {
  toPublicProfile,
  type PublicProfileDto,
} from "../auth/auth.mapper.js";
import type { UpdateProfileBody } from "./user.schema.js";

export async function getOwnProfile(
  prisma: Database,
  userId: number,
): Promise<PublicProfileDto> {
  const profile = await prisma.userProfile.findUnique({ where: { userId } });
  if (!profile) {
    throw AppError.notFound("Profile not found");
  }
  return toPublicProfile(profile);
}

export async function updateOwnProfile(
  prisma: Database,
  userId: number,
  input: UpdateProfileBody,
): Promise<PublicProfileDto> {
  const existing = await prisma.userProfile.findUnique({ where: { userId } });
  if (!existing) {
    throw AppError.notFound("Profile not found");
  }

  const profile = await prisma.userProfile.update({
    where: { userId },
    data: {
      ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
      ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    },
  });

  return toPublicProfile(profile);
}
