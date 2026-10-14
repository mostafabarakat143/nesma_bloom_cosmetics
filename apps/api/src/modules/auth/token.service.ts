import { createHash, randomBytes, randomUUID } from "node:crypto";

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import type { UserRole } from "../../generated/prisma/client.js";

export type AccessTokenClaims = {
  sub: string;
  role: UserRole;
  sid: string;
};

export type ActiveSession = {
  role: UserRole;
};

type SessionMeta = {
  userAgent?: string;
  ipAddress?: string;
};

/** Multi-tab stale refresh grace after graceful rotation (not a theft oracle). */
export const REFRESH_ROTATION_GRACE_MS = 30_000;

export function hashRefreshToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateRefreshToken(): string {
  return randomBytes(48).toString("base64url");
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function signAccessToken(
  env: Env,
  claims: AccessTokenClaims,
): Promise<string> {
  const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);

  return new SignJWT({
    role: claims.role,
    sid: claims.sid,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_ACCESS_TTL_SECONDS}s`)
    .sign(secret);
}

export async function verifyAccessToken(
  env: Env,
  token: string,
): Promise<AccessTokenClaims> {
  try {
    const secret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    return parseAccessClaims(payload);
  } catch {
    throw AppError.unauthorized("Authentication required");
  }
}

function parseAccessClaims(payload: JWTPayload): AccessTokenClaims {
  const sub = payload.sub;
  const role = payload.role;
  const sid = payload.sid;

  if (
    typeof sub !== "string" ||
    typeof sid !== "string" ||
    (role !== "CUSTOMER" && role !== "ADMIN")
  ) {
    throw AppError.unauthorized("Authentication required");
  }

  return { sub, role, sid };
}

export async function createRefreshSession(
  prisma: Database,
  env: Env,
  userId: string,
  meta: SessionMeta = {},
): Promise<{ sessionId: string; rawRefreshToken: string }> {
  const rawRefreshToken = generateRefreshToken();
  const tokenHash = hashRefreshToken(rawRefreshToken);
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000);

  const session = await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 512),
      ipAddress: meta.ipAddress?.slice(0, 45),
    },
  });

  return { sessionId: session.id, rawRefreshToken };
}

async function revokeAllActiveSessions(
  tx: Parameters<Parameters<Database["$transaction"]>[0]>[0],
  userId: string,
): Promise<void> {
  await tx.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Atomically rotates a refresh token.
 *
 * Graceful rotation sets replacedById on the old row. Presenting that revoked
 * token within REFRESH_ROTATION_GRACE_MS yields 401 without revoke-all (multi-tab).
 * Delayed reuse after the grace window still revoke-all (suspicious replay).
 * Logout/hard revoke leaves replacedById null; reuse triggers revoke-all.
 *
 * Tradeoff: the grace window reduces accidental logout but cannot securely
 * distinguish every stolen-token replay from legitimate concurrency.
 */
type RotateOutcome =
  | {
      kind: "rotated";
      userId: string;
      role: UserRole;
      sessionId: string;
      rawRefreshToken: string;
    }
  | { kind: "unauthorized" }
  | { kind: "revoked_all" };

export async function rotateRefreshSession(
  prisma: Database,
  env: Env,
  rawRefreshToken: string,
  meta: SessionMeta = {},
): Promise<{
  userId: string;
  role: UserRole;
  sessionId: string;
  rawRefreshToken: string;
}> {
  const tokenHash = hashRefreshToken(rawRefreshToken);

  // Return structured outcomes so revoke-all can COMMIT before throwing.
  // Throwing AppError inside $transaction would roll back the revoke-all.
  const outcome = await prisma.$transaction(async (tx): Promise<RotateOutcome> => {
    const existing = await tx.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, role: true, status: true } } },
    });

    if (!existing) {
      return { kind: "unauthorized" };
    }

    if (existing.user.status !== "ACTIVE") {
      return { kind: "unauthorized" };
    }

    const now = Date.now();
    const isExpired = existing.expiresAt.getTime() <= now;
    const isRevoked = existing.revokedAt !== null;

    if (isRevoked || isExpired) {
      const graceful =
        existing.replacedById !== null &&
        existing.revokedAt !== null &&
        now - existing.revokedAt.getTime() <= REFRESH_ROTATION_GRACE_MS;

      if (graceful) {
        // Stale tab / concurrent loser — do not return a new refresh token.
        return { kind: "unauthorized" };
      }

      await revokeAllActiveSessions(tx, existing.userId);
      return { kind: "revoked_all" };
    }

    const nextId = randomUUID();
    const rawNext = generateRefreshToken();
    const nextHash = hashRefreshToken(rawNext);
    const expiresAt = new Date(
      Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000,
    );

    const revoked = await tx.refreshToken.updateMany({
      where: {
        id: existing.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        revokedAt: new Date(),
        replacedById: nextId,
      },
    });

    if (revoked.count !== 1) {
      const again = await tx.refreshToken.findUnique({
        where: { id: existing.id },
        select: { revokedAt: true, replacedById: true },
      });

      if (again?.replacedById) {
        // Concurrent winner already rotated — no revoke-all, no new token.
        return { kind: "unauthorized" };
      }

      await revokeAllActiveSessions(tx, existing.userId);
      return { kind: "revoked_all" };
    }

    await tx.refreshToken.create({
      data: {
        id: nextId,
        userId: existing.userId,
        tokenHash: nextHash,
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 512),
        ipAddress: meta.ipAddress?.slice(0, 45),
      },
    });

    return {
      kind: "rotated",
      userId: existing.user.id,
      role: existing.user.role,
      sessionId: nextId,
      rawRefreshToken: rawNext,
    };
  });

  if (outcome.kind === "rotated") {
    return {
      userId: outcome.userId,
      role: outcome.role,
      sessionId: outcome.sessionId,
      rawRefreshToken: outcome.rawRefreshToken,
    };
  }

  throw AppError.unauthorized("Authentication required");
}

export async function revokeRefreshSessionByHash(
  prisma: Database,
  rawRefreshToken: string,
): Promise<void> {
  const tokenHash = hashRefreshToken(rawRefreshToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeSessionById(
  prisma: Database,
  sessionId: string,
): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Immediate logout invalidation + live user status/role from PostgreSQL.
 * Cost: one indexed PK lookup with user join per protected request.
 */
export async function assertSessionActive(
  prisma: Database,
  sessionId: string,
  userId: string,
): Promise<ActiveSession> {
  const session = await prisma.refreshToken.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
      user: {
        select: {
          status: true,
          role: true,
        },
      },
    },
  });

  if (
    !session ||
    session.userId !== userId ||
    session.revokedAt !== null ||
    session.expiresAt <= new Date()
  ) {
    throw AppError.unauthorized("Authentication required");
  }

  if (session.user.status === "DISABLED") {
    throw AppError.unauthorized("Authentication required");
  }

  return { role: session.user.role };
}
