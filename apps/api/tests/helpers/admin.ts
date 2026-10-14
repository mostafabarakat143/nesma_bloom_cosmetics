import type { Express } from "express";
import request from "supertest";

import type { Database } from "../../src/config/database.js";
import { hashPassword } from "../../src/modules/auth/password.service.js";
import {
  TEST_ORIGIN,
  authHeaders,
  parseCookies,
} from "./auth.js";

export async function createAdminUser(
  prisma: Database,
  email = `admin-${Date.now()}@example.com`,
  password = "Password123!",
) {
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: "ADMIN",
      profile: { create: {} },
    },
  });

  return { user, email, password };
}

export async function loginAsAdmin(
  app: Express,
  email: string,
  password: string,
) {
  const response = await request(app)
    .post("/api/v1/auth/login")
    .set("Origin", TEST_ORIGIN)
    .send({ email, password });

  if (response.status !== 200) {
    throw new Error(`Admin login failed: ${response.status}`);
  }

  return parseCookies(response);
}

export { authHeaders, TEST_ORIGIN };
