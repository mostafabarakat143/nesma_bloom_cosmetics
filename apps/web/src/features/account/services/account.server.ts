import { bearerInit, callExpress } from "@/shared/http/server";
import type { PasswordChangeValue } from "../lib/password-change";
import type { ProfileUpdate } from "../lib/profile-update";

export const accountServerService = {
  getProfile: (token: string) => callExpress("users/me/profile", bearerInit(token, "GET")),
  updateProfile: (token: string, input: ProfileUpdate) => callExpress("users/me/profile", {
    ...bearerInit(token, "PATCH", { "content-type": "application/json" }),
    body: JSON.stringify(input),
  }),
  uploadAvatar: (token: string, body: FormData) => callExpress("users/me/avatar", {
    method: "POST",
    headers: { accept: "application/json", authorization: `Bearer ${token}` },
    body,
  }, 30_000),
  changePassword: (token: string, input: PasswordChangeValue) => callExpress("auth/change-password", {
    ...bearerInit(token, "POST", { "content-type": "application/json" }),
    body: JSON.stringify(input),
  }),
};
