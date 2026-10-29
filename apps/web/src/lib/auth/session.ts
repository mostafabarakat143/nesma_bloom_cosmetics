import { cache } from "react";
import { redirectTo } from "@/i18n/redirect";
import { parsePublicUser } from "./credentials";
import { readSessionToken } from "./cookies";
import { bearerInit, callExpress } from "./express";
import { safeNextPath } from "./redirect";

export type SessionUser = {
  id: number;
  email: string;
  role: "CUSTOMER" | "ADMIN";
};

export type VerifiedSession =
  | { state: "anonymous" }
  | { state: "authenticated"; user: SessionUser }
  | { state: "invalid" }
  | { state: "unavailable" };

async function loadVerifiedUser(): Promise<VerifiedSession> {
  const token = await readSessionToken();
  if (!token) {
    return { state: "anonymous" };
  }

  const result = await callExpress("/api/v1/auth/me", bearerInit(token, "GET"));
  if (result.kind === "unreachable") {
    return { state: "unavailable" };
  }
  if (result.kind === "error") {
    return result.status === 401 ? { state: "invalid" } : { state: "unavailable" };
  }

  if (typeof result.data !== "object" || result.data === null || !("user" in result.data)) {
    return { state: "invalid" };
  }

  const user = parsePublicUser(result.data.user);
  if (!user || user.status !== "ACTIVE") {
    return { state: "invalid" };
  }

  return {
    state: "authenticated",
    user: { id: user.id, email: user.email, role: user.role },
  };
}
export const getVerifiedUser = cache(loadVerifiedUser);
export async function requireUser(nextPath: string): Promise<SessionUser> {
  const session = await getVerifiedUser();
  if (session.state === "authenticated") {
    return session.user;
  }

  const next = encodeURIComponent(safeNextPath(nextPath));
  const expired = session.state === "invalid" ? "&expired=1" : "";
  await redirectTo(`/login?next=${next}${expired}`);
  return undefined as never;
}
