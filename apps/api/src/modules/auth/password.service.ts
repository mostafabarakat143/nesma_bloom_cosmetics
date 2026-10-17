import { hash, verify } from "@node-rs/argon2";

/**
 * Argon2id via @node-rs/argon2 (prebuilt native bindings).
 * Chosen over the `argon2` package because it does not require a local C++ toolchain.
 */
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
    return false;
  }
}
