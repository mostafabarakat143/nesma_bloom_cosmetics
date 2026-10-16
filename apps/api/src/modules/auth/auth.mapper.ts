import type { User, UserProfile } from "../../generated/prisma/client.js";

export type PublicUserDto = {
  id: number;
  email: string;
  role: User["role"];
  status: User["status"];
  createdAt: string;
  updatedAt: string;
};

export type PublicProfileDto = {
  id: number;
  userId: number;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toPublicUser(user: User): PublicUserDto {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export function toPublicProfile(profile: UserProfile): PublicProfileDto {
  return {
    id: profile.id,
    userId: profile.userId,
    firstName: profile.firstName,
    lastName: profile.lastName,
    phone: profile.phone,
    avatarUrl: profile.avatarUrl,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}
