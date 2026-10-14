import { describe, expect, it } from "vitest";

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
});
