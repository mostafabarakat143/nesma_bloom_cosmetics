import { isRecord } from "@/shared/lib/guards";
import { parseAccountProfile, type AccountProfile } from "@/features/account/lib/profile-parse";
import { accountServerService } from "@/features/account/services/account.server";
import { readSessionToken } from "@/features/auth/lib/cookies";
import { cache } from "react";

async function loadAccountProfile(): Promise<AccountProfile | null> {
  const token = await readSessionToken();
  if (!token) {
    return null;
  }

  const result = await accountServerService.getProfile(token);
  if (result.kind !== "ok" || !isRecord(result.data) || !("profile" in result.data)) {
    return null;
  }
  return parseAccountProfile(result.data.profile);
}
export const getAccountProfile = cache(loadAccountProfile);
