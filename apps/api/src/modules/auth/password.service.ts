import { hash, verify } from "@node-rs/argon2";

import { AppError } from "../../common/errors/app-error.js";

export async function hashPassword(plainPassword: string): Promise<string> {
  return hash(plainPassword, {
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyPassword(
  passwordHash: string,
  plainPassword: string,
): Promise<boolean> {
  try {
    return await verify(passwordHash, plainPassword);
  } catch {
    throw AppError.internal(
      "Password verification failed.",
      "PASSWORD_VERIFICATION_FAILED",
    );
  }
}
