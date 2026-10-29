import { cache } from "react";
import { readSessionToken } from "./cookies";
import { bearerInit, callExpress } from "./express";
import { parseAccountProfile, type AccountProfile } from "./profile-parse";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function loadAccountProfile(): Promise<AccountProfile | null> {
  const token = await readSessionToken();
  if (!token) {
    return null;
  }

  const result = await callExpress(
    "/api/v1/users/me/profile",
    bearerInit(token, "GET"),
  );
  if (result.kind !== "ok" || !isRecord(result.data) || !("profile" in result.data)) {
    return null;
  }
  return parseAccountProfile(result.data.profile);
}
export const getAccountProfile = cache(loadAccountProfile);
