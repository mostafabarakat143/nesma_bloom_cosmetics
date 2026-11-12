import * as argon2 from "@node-rs/argon2";
import express from "express";
import pino from "pino";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createErrorMiddleware } from "../../src/common/middlewares/error.middleware.js";
import { loadEnv } from "../../src/config/env.js";
import { baseTestEnvVars } from "../helpers/test-env.js";

vi.mock("@node-rs/argon2", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@node-rs/argon2")>();
  return { ...actual, verify: vi.fn(actual.verify) };
});

import {
  hashPassword,
  verifyPassword,
} from "../../src/modules/auth/password.service.js";

describe("password.service", () => {
  it("hashes with Argon2id and verifies correctly", async () => {
    const hash = await hashPassword("CorrectHorseBatteryStaple1");

    expect(hash.startsWith("$argon2id$")).toBe(true);
    expect(hash).not.toContain("CorrectHorseBatteryStaple1");
    await expect(verifyPassword(hash, "CorrectHorseBatteryStaple1")).resolves.toBe(
      true,
    );
    await expect(verifyPassword(hash, "wrong-password")).resolves.toBe(false);
  });

  it("treats an invalid stored hash as an internal failure", async () => {
    const error = await verifyPassword("invalid-stored-hash", "password")
      .catch((failure: unknown) => failure);
    expect(error).toMatchObject({
      statusCode: 500,
      code: "PASSWORD_VERIFICATION_FAILED",
      isOperational: false,
    });
    expect(error).not.toHaveProperty("cause");
  });

  it("logs verification failures without exposing secrets or returning authentication success", async () => {
    const password = "private-password-for-test";
    const storedHash = "$argon2id$private-stored-hash-for-test";
    vi.mocked(argon2.verify).mockRejectedValueOnce(
      new Error(`Native failure with ${password} and ${storedHash}`),
    );
    const logs: string[] = [];
    const logger = pino({ level: "error" }, {
      write: (entry) => { logs.push(entry); },
    });
    const app = express();
    app.post("/verify", async (_req, res) => {
      const valid = await verifyPassword(storedHash, password);
      res.json({ valid });
    });
    app.use(createErrorMiddleware(loadEnv(baseTestEnvVars), logger));

    const response = await request(app).post("/verify");

    expect(response.status).toBe(500);
    expect(response.body).toEqual({ status: "error", message: "Internal server error." });
    expect(logs).toHaveLength(1);
    expect(JSON.parse(logs[0]!)).toMatchObject({
      code: "PASSWORD_VERIFICATION_FAILED",
      level: 50,
    });
    for (const secret of [password, storedHash, "Native failure"]) {
      expect(logs.join("")).not.toContain(secret);
      expect(JSON.stringify(response.body)).not.toContain(secret);
    }
  });
});
