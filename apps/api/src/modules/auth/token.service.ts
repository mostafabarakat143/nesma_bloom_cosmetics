import { randomUUID } from "node:crypto";

import { SignJWT, jwtVerify, type JWTPayload } from "jose";

import type { Database } from "../../config/database.js";
import type { Env } from "../../config/env.js";
import { AppError } from "../../common/errors/app-error.js";
import { parsePositiveIntId } from "../../common/validation/ids.js";
import type { UserRole } from "../../generated/prisma/client.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type BearerTokenClaims = {
  sub: number;
  jti: string;
  /** Unix seconds */
  exp: number;
};

export type AuthenticatedPrincipal = {
  id: number;
  role: UserRole;
  jti: string;
  exp: number;
};

function secretKey(env: Env): Uint8Array {
  return new TextEncoder().encode(env.JWT_ACCESS_SECRET);
}

/** Issue a Bearer JWT. Role is not embedded for authorization (loaded from DB). */
export async function signBearerToken(
  env: Env,
  userId: number,
): Promise<string> {
  const jti = randomUUID();

  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setJti(jti)
    .setIssuer(env.JWT_ISSUER)
    .setAudience(env.JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${env.JWT_TTL_SECONDS}s`)
    .sign(secretKey(env));
}

/**
 * Cryptographic JWT verification (signature, exp, iss, aud, sub, jti).
 * Does not check revocation or user status.
 */
export async function verifyBearerToken(
  env: Env,
  token: string,
): Promise<BearerTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, secretKey(env), {
      algorithms: ["HS256"],
      issuer: env.JWT_ISSUER,
      audience: env.JWT_AUDIENCE,
    });
    return parseBearerClaims(payload);
  } catch {
    throw AppError.unauthorized("Authentication required");
  }
}

function parseBearerClaims(payload: JWTPayload): BearerTokenClaims {
  const sub = parsePositiveIntId(payload.sub);
  const jti = typeof payload.jti === "string" ? payload.jti : null;
  const exp =
    typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? payload.exp
      : null;

  if (sub === null || jti === null || !UUID_RE.test(jti) || exp === null) {
    throw AppError.unauthorized("Authentication required");
  }

  return { sub, jti, exp };
}

export async function isJtiRevoked(
  prisma: Database,
  jti: string,
): Promise<boolean> {
  const row = await prisma.revokedAccessToken.findUnique({
    where: { jti },
    select: { id: true },
  });
  return row !== null;
}

/**
 * Idempotent revoke by jti. Concurrent logouts are safe (unique jti).
 * Does not store the raw JWT.
 */
export async function revokeAccessToken(
  prisma: Database,
  data: { jti: string; userId: number; expiresAt: Date },
): Promise<void> {
  try {
    await prisma.revokedAccessToken.create({
      data: {
        jti: data.jti,
        userId: data.userId,
        expiresAt: data.expiresAt,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return;
    }
    throw error;
  }
}

export async function loadActiveUserRole(
  prisma: Database,
  userId: number,
): Promise<UserRole> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true, role: true },
  });

  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Authentication required");
  }

  return user.role;
}

/**
 * Full protected-route auth: verify JWT, reject revoked jti, load live role.
 */
export async function authenticateBearerRequest(
  env: Env,
  prisma: Database,
  token: string,
): Promise<AuthenticatedPrincipal> {
  const claims = await verifyBearerToken(env, token);

  if (await isJtiRevoked(prisma, claims.jti)) {
    throw AppError.unauthorized("Authentication required");
  }

  const role = await loadActiveUserRole(prisma, claims.sub);
  return {
    id: claims.sub,
    role,
    jti: claims.jti,
    exp: claims.exp,
  };
}

/**
 * Logout-only auth: verify JWT cryptographically and load user id/exp/jti.
 * Allows already-revoked jti so logout stays idempotent. Still requires ACTIVE user
 * to associate the revoke row; disabled users may still clear a token via revoke
 * without needing role — we only need a valid sub.
 */
export async function authenticateBearerForLogout(
  env: Env,
  prisma: Database,
  token: string,
): Promise<AuthenticatedPrincipal> {
  const claims = await verifyBearerToken(env, token);

  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
    select: { role: true, status: true },
  });

  if (!user) {
    throw AppError.unauthorized("Authentication required");
  }

  // Prefer DB role when ACTIVE; DISABLED still allowed to revoke their token.
  return {
    id: claims.sub,
    role: user.role,
    jti: claims.jti,
    exp: claims.exp,
  };
}

export function extractBearerToken(
  authorizationHeader: string | undefined,
): string | null {
  if (!authorizationHeader) {
    return null;
  }
  const match = /^Bearer\s+(\S+)$/i.exec(authorizationHeader.trim());
  return match?.[1] ?? null;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}
