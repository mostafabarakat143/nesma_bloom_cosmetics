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
  createRefreshSession,
  generateCsrfToken,
  revokeRefreshSessionByHash,
  revokeSessionById,
  rotateRefreshSession,
  signAccessToken,
} from "./token.service.js";

const GENERIC_AUTH_ERROR = "Invalid email or password";

type RequestMeta = {
  userAgent?: string;
  ipAddress?: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
};

export type AuthResult = {
  user: PublicUserDto;
  tokens: AuthTokens;
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
  meta: RequestMeta,
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

  return issueAuthSession(prisma, env, user, meta);
}

export async function loginUser(
  prisma: Database,
  env: Env,
  input: LoginBody,
  meta: RequestMeta,
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

  return issueAuthSession(prisma, env, user, meta);
}

export async function refreshAuthSession(
  prisma: Database,
  env: Env,
  rawRefreshToken: string | undefined,
  meta: RequestMeta,
): Promise<AuthResult> {
  if (!rawRefreshToken) {
    throw AppError.unauthorized("Authentication required");
  }

  const rotated = await rotateRefreshSession(
    prisma,
    env,
    rawRefreshToken,
    meta,
  );

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: rotated.userId },
  });

  const accessToken = await signAccessToken(env, {
    sub: user.id,
    role: user.role,
    sid: rotated.sessionId,
  });

  return {
    user: toPublicUser(user),
    tokens: {
      accessToken,
      refreshToken: rotated.rawRefreshToken,
      csrfToken: generateCsrfToken(),
    },
  };
}

export async function logoutUser(
  prisma: Database,
  options: {
    rawRefreshToken?: string;
    sessionId?: string;
  },
): Promise<void> {
  if (options.rawRefreshToken) {
    await revokeRefreshSessionByHash(prisma, options.rawRefreshToken);
  } else if (options.sessionId) {
    await revokeSessionById(prisma, options.sessionId);
  }
}

export async function getCurrentUser(
  prisma: Database,
  userId: string,
): Promise<PublicUserDto> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Authentication required");
  }
  return toPublicUser(user);
}

async function issueAuthSession(
  prisma: Database,
  env: Env,
  user: {
    id: string;
    email: string;
    role: "CUSTOMER" | "ADMIN";
    status: "ACTIVE" | "DISABLED";
    createdAt: Date;
    updatedAt: Date;
    passwordHash: string;
  },
  meta: RequestMeta,
): Promise<AuthResult> {
  const session = await createRefreshSession(prisma, env, user.id, meta);
  const accessToken = await signAccessToken(env, {
    sub: user.id,
    role: user.role,
    sid: session.sessionId,
  });

  return {
    user: toPublicUser(user),
    tokens: {
      accessToken,
      refreshToken: session.rawRefreshToken,
      csrfToken: generateCsrfToken(),
    },
  };
}

/** Mitigate timing oracle when user is missing. */
async function dummyPasswordWork(): Promise<void> {
  await hashPassword("invalid-password-timing-pad");
}
