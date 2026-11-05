import { randomUUID } from "node:crypto";

import { SignJWT } from "jose";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { Database } from "../../src/config/database.js";
import { loadEnv } from "../../src/config/env.js";
import { changePassword, loginUser, resetPassword } from "../../src/modules/auth/auth.service.js";
import { hashPassword } from "../../src/modules/auth/password.service.js";
import {
  authenticateBearerForLogout,
  authenticateBearerRequest,
  signBearerToken,
  verifyBearerToken,
} from "../../src/modules/auth/token.service.js";
import { baseTestEnvVars } from "../helpers/test-env.js";

const env = loadEnv(baseTestEnvVars);
const oldPassword = "OriginalPassword123!";
const newPassword = "UpdatedPassword123!";
let originalHash: string;

beforeAll(async () => { originalHash = await hashPassword(oldPassword); });
beforeEach(() => {
  // Freeze only the clock: password hashing and request processing remain real.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-05T12:00:00.750Z"));
});
afterEach(() => vi.useRealTimers());

function buildDatabase() {
  const user = {
    id: 7,
    email: "version-test@example.com",
    passwordHash: originalHash,
    authVersion: 0,
    passwordChangedAt: null as Date | null,
    role: "CUSTOMER",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const database = {
    user: {
      // Each read is a snapshot, just like a completed database query.
      findUnique: vi.fn(async () => ({ ...user })),
      updateMany: vi.fn(async (args: {
        where: { authVersion: number; status: string };
        data: { passwordHash: string; passwordChangedAt: Date; authVersion: { increment: number } };
      }) => {
        if (user.authVersion !== args.where.authVersion || user.status !== args.where.status) {
          return { count: 0 };
        }
        user.passwordHash = args.data.passwordHash;
        user.passwordChangedAt = args.data.passwordChangedAt;
        user.authVersion += args.data.authVersion.increment;
        return { count: 1 };
      }),
    },
    revokedAccessToken: { findUnique: vi.fn(async () => null) },
    passwordResetToken: {
      findUnique: vi.fn(async () => ({
        id: 1,
        usedAt: null,
        expiresAt: new Date(Date.now() + 60_000),
        user: { ...user },
      })),
      updateMany: vi.fn(async () => ({ count: 1 })),
    },
    async $transaction<T>(run: (tx: Database) => Promise<T>): Promise<T> {
      return run(database as unknown as Database);
    },
  };
  return { database, prisma: database as unknown as Database, user };
}

describe("authentication versions", () => {
  it("allows immediate login after a password change in the same JWT second", async () => {
    const { prisma, user } = buildDatabase();
    const oldToken = await signBearerToken(env, user.id, user.authVersion);

    await changePassword(prisma, user.id, {
      currentPassword: oldPassword,
      newPassword,
    });
    const login = await loginUser(prisma, env, { email: user.email, password: newPassword });
    const oldClaims = await verifyBearerToken(env, oldToken);
    const newClaims = await verifyBearerToken(env, login.token);

    expect(newClaims.iat).toBe(oldClaims.iat);
    expect(newClaims.authVersion).toBe(1);
    await expect(authenticateBearerRequest(env, prisma, login.token))
      .resolves.toMatchObject({ id: user.id });
    await expect(authenticateBearerRequest(env, prisma, oldToken))
      .rejects.toMatchObject({ statusCode: 401 });
    await expect(authenticateBearerForLogout(env, prisma, oldToken))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it("invalidates a token obtained with the old password during a reset", async () => {
    const { database, prisma, user } = buildDatabase();
    const readResetToken = database.passwordResetToken.findUnique.getMockImplementation()!;
    let racedToken = "";
    database.passwordResetToken.findUnique.mockImplementationOnce(async () => {
      const row = await readResetToken();
      // The reset has begun, but its password update has not committed yet.
      vi.setSystemTime(new Date(Date.now() + 1500));
      racedToken = (await loginUser(prisma, env, {
        email: user.email,
        password: oldPassword,
      })).token;
      return row;
    });

    await resetPassword(prisma, { token: "test-reset-token", newPassword });

    expect((await verifyBearerToken(env, racedToken)).authVersion).toBe(0);
    expect(user.authVersion).toBe(1);
    await expect(authenticateBearerRequest(env, prisma, racedToken))
      .rejects.toMatchObject({ statusCode: 401 });
    const login = await loginUser(prisma, env, { email: user.email, password: newPassword });
    await expect(authenticateBearerRequest(env, prisma, login.token))
      .resolves.toMatchObject({ id: user.id });
  });

  it("does not overwrite a concurrent password change using stale credentials", async () => {
    const { database, prisma, user } = buildDatabase();
    database.user.findUnique.mockImplementationOnce(async () => {
      const snapshot = { ...user };
      user.authVersion += 1;
      return snapshot;
    });

    await expect(changePassword(prisma, user.id, {
      currentPassword: oldPassword,
      newPassword,
    })).rejects.toMatchObject({ statusCode: 401 });
    expect(user.authVersion).toBe(1);
    expect(user.passwordHash).toBe(originalHash);
  });

  it("rejects a reset if the account version changed after reading its token", async () => {
    const { database, prisma, user } = buildDatabase();
    const readResetToken = database.passwordResetToken.findUnique.getMockImplementation()!;
    database.passwordResetToken.findUnique.mockImplementationOnce(async () => {
      const row = await readResetToken();
      user.authVersion += 1;
      return row;
    });

    await expect(resetPassword(prisma, { token: "test-reset-token", newPassword }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(user.passwordHash).toBe(originalHash);
  });

  it("allows a disabled account to revoke a current-version token", async () => {
    const { prisma, user } = buildDatabase();
    user.status = "DISABLED";
    const token = await signBearerToken(env, user.id, user.authVersion);
    await expect(authenticateBearerForLogout(env, prisma, token))
      .resolves.toMatchObject({ id: user.id });
    await expect(authenticateBearerRequest(env, prisma, token))
      .rejects.toMatchObject({ statusCode: 401 });
  });

  it.each([undefined, -1, 0.5, "0", 2_147_483_648])(
    "rejects a missing or invalid account-version claim %j",
    async (authVersion) => {
      const token = await new SignJWT({ authVersion })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject("7")
        .setJti(randomUUID())
        .setIssuer(env.JWT_ISSUER)
        .setAudience(env.JWT_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime("60s")
        .sign(new TextEncoder().encode(env.JWT_ACCESS_SECRET));
      await expect(verifyBearerToken(env, token)).rejects.toMatchObject({ statusCode: 401 });
    },
  );
});
