import type { Response } from "supertest";

export const TEST_ORIGIN = "http://localhost:3000";

export function authHeaders(token: string): Record<string, string> {
  return {
    Origin: TEST_ORIGIN,
    Authorization: `Bearer ${token}`,
  };
}

export function extractToken(response: Response): string {
  const token = response.body?.data?.token;
  if (typeof token !== "string" || token.length === 0) {
    throw new Error("Response did not include data.token");
  }
  return token;
}
