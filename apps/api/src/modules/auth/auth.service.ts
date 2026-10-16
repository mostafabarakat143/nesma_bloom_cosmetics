import { AppError } from "../../common/errors/app-error.js";
import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import {
  normalizeEmail,
  type LoginBody,
  type RegisterBody,
} from "./auth.schema.js";
import { toPublicUser, type PublicUserDto } from "./auth.mapper.js";
import { hashPassword, verifyPassword } from "./password.service.js";
import {
  revokeAccessToken,
  signBearerToken,
} from "./token.service.js";

const GENERIC_AUTH_ERROR = "Invalid email or password.";

export type AuthResult = {
  user: PublicUserDto;
  token: string;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

export async function registerUser(
  prisma: Database,
  env: Env,
  input: RegisterBody,
): Promise<AuthResult> {
  const email = normalizeEmail(input.email);
  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          role: "CUSTOMER",
          status: "ACTIVE",
          profile: {
            create: {
              firstName: input.firstName ?? null,
              lastName: input.lastName ?? null,
            },
          },
        },
      });
      return created;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw AppError.conflict(
        "An account with this email already exists. Please log in.",
      );
    }
    throw error;
  }

  return issueBearerAuth(env, user);
}

export async function loginUser(
  prisma: Database,
  env: Env,
  input: LoginBody,
): Promise<AuthResult> {
  const email = normalizeEmail(input.email);

  const user = await prisma.user.findUnique({ where: { email } });

  // Generic 401 for missing user, bad password, and disabled accounts.
  if (!user) {
    await dummyPasswordWork();
    throw AppError.unauthorized(GENERIC_AUTH_ERROR);
  }

  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid || user.status !== "ACTIVE") {
    throw AppError.unauthorized(GENERIC_AUTH_ERROR);
  }

  return issueBearerAuth(env, user);
}

/** Idempotent Mode B revoke by jti. */
export async function logoutUser(
  prisma: Database,
  options: { userId: number; jti: string; exp: number },
): Promise<void> {
  await revokeAccessToken(prisma, {
    jti: options.jti,
    userId: options.userId,
    expiresAt: new Date(options.exp * 1000),
  });
}

export async function getCurrentUser(
  prisma: Database,
  userId: number,
): Promise<PublicUserDto> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Authentication required");
  }
  return toPublicUser(user);
}

async function issueBearerAuth(
  env: Env,
  user: {
    id: number;
    email: string;
    role: "CUSTOMER" | "ADMIN";
    status: "ACTIVE" | "DISABLED";
    createdAt: Date;
    updatedAt: Date;
    passwordHash: string;
  },
): Promise<AuthResult> {
  const token = await signBearerToken(env, user.id);
  return {
    user: toPublicUser(user),
    token,
  };
}

/** Mitigate timing oracle when user is missing. */
async function dummyPasswordWork(): Promise<void> {
  await hashPassword("invalid-password-timing-pad");
}
