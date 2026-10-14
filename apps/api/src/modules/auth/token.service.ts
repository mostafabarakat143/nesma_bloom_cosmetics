import { createHash, randomBytes } from "node:crypto";

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

type SessionMeta = {
  userAgent?: string;
  ipAddress?: string;
};

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

/**
 * Atomically rotates a refresh token.
 * Uses updateMany(revokedAt: null) as an optimistic lock so only one concurrent
 * rotation succeeds. A failed lock on an already-revoked token triggers
 * revoke-all (replay / theft detection). Legitimate concurrent refreshes:
 * one wins; the loser is treated as replay and all sessions are revoked —
 * clients should serialize refresh or tolerate re-login after parallel tabs race.
 */
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

  return prisma.$transaction(async (tx) => {
    const existing = await tx.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, role: true, status: true } } },
    });

    if (!existing) {
      throw AppError.unauthorized("Authentication required");
    }

    if (existing.user.status !== "ACTIVE") {
      throw AppError.unauthorized("Invalid email or password");
    }

    if (existing.revokedAt !== null || existing.expiresAt <= new Date()) {
      await tx.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw AppError.unauthorized("Authentication required");
    }

    const revoked = await tx.refreshToken.updateMany({
      where: {
        id: existing.id,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { revokedAt: new Date() },
    });

    if (revoked.count !== 1) {
      await tx.refreshToken.updateMany({
        where: { userId: existing.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw AppError.unauthorized("Authentication required");
    }

    const rawNext = generateRefreshToken();
    const nextHash = hashRefreshToken(rawNext);
    const expiresAt = new Date(
      Date.now() + env.REFRESH_TOKEN_TTL_SECONDS * 1000,
    );

    const next = await tx.refreshToken.create({
      data: {
        userId: existing.userId,
        tokenHash: nextHash,
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 512),
        ipAddress: meta.ipAddress?.slice(0, 45),
      },
    });

    return {
      userId: existing.user.id,
      role: existing.user.role,
      sessionId: next.id,
      rawRefreshToken: rawNext,
    };
  });
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
 * Immediate logout invalidation check.
 * Cost: one indexed PK lookup on refresh_tokens per protected request.
 */
export async function assertSessionActive(
  prisma: Database,
  sessionId: string,
  userId: string,
): Promise<void> {
  const session = await prisma.refreshToken.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
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
}
