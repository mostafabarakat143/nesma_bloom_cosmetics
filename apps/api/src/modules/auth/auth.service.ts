import { createHash, randomBytes } from "node:crypto";

import { AppError } from "../../common/errors/app-error.js";
import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import type { Logger } from "../../config/logger.js";
import {
  normalizeEmail,
  type ChangePasswordBody,
  type ForgotPasswordBody,
  type LoginBody,
  type RegisterBody,
  type ResetPasswordBody,
} from "./auth.schema.js";
import { toPublicUser, type PublicUserDto } from "./auth.mapper.js";
import type { PasswordResetMailer } from "./password-reset.mailer.js";
import { hashPassword, verifyPassword } from "./password.service.js";
import {
  revokeAccessToken,
  signBearerToken,
} from "./token.service.js";

const GENERIC_AUTH_ERROR = "Invalid email or password.";
const RESET_REQUEST_MESSAGE =
  "If an account exists for that email, password reset instructions have been sent.";

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

export async function changePassword(
  prisma: Database,
  userId: number,
  input: ChangePasswordBody,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Authentication required");
  }

  const currentValid = await verifyPassword(
    user.passwordHash,
    input.currentPassword,
  );
  if (!currentValid) {
    throw AppError.unauthorized("Current password is incorrect.");
  }

  if (input.currentPassword === input.newPassword) {
    throw AppError.badRequest(
      "New password must be different from the current password.",
    );
  }

  const passwordHash = await hashPassword(input.newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
    },
  });
}

/**
 * Always completes without saying whether the email exists.
 * The raw token is handed to the mailer only.
 */
export async function requestPasswordReset(
  prisma: Database,
  env: Env,
  logger: Logger,
  mailer: PasswordResetMailer,
  input: ForgotPasswordBody,
): Promise<string> {
  const email = normalizeEmail(input.email);
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    return RESET_REQUEST_MESSAGE;
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashResetToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.PASSWORD_RESET_TTL_SECONDS * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: now },
    });
    await tx.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });
  });

  const resetUrl = new URL("/reset-password", env.APP_PUBLIC_URL);
  resetUrl.searchParams.set("token", token);

  try {
    await mailer({ email: user.email, resetUrl: resetUrl.toString() });
  } catch (error) {
    logger.error({ err: error, email: user.email }, "Password reset delivery failed");
  }

  return RESET_REQUEST_MESSAGE;
}

export async function resetPassword(
  prisma: Database,
  input: ResetPasswordBody,
): Promise<void> {
  const tokenHash = hashResetToken(input.token);
  const now = new Date();
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, status: true, passwordHash: true } },
    },
  });

  if (
    !row ||
    row.usedAt ||
    row.expiresAt <= now ||
    row.user.status !== "ACTIVE"
  ) {
    throw AppError.badRequest("This reset link is invalid or has expired.");
  }

  const unchanged = await verifyPassword(row.user.passwordHash, input.newPassword);
  if (unchanged) {
    throw AppError.badRequest(
      "New password must be different from the current password.",
    );
  }

  const passwordHash = await hashPassword(input.newPassword);

  await prisma.$transaction(async (tx) => {
    const marked = await tx.passwordResetToken.updateMany({
      where: {
        id: row.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: { usedAt: now },
    });

    if (marked.count !== 1) {
      throw AppError.badRequest("This reset link is invalid or has expired.");
    }

    await tx.user.update({
      where: { id: row.user.id },
      data: {
        passwordHash,
        passwordChangedAt: now,
      },
    });
  });
}

export async function purgeExpiredPasswordResetTokens(
  prisma: Database,
  now: Date = new Date(),
): Promise<number> {
  const result = await prisma.passwordResetToken.deleteMany({
    where: { expiresAt: { lt: now } },
  });
  return result.count;
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
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
    passwordChangedAt: Date | null;
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
