import { requestJson, requestFile } from "@/shared/http/client";
import type { PasswordChangeValue } from "../lib/password-change";
import type { ProfileUpdate } from "../lib/profile-update";

export const accountService = {
  updateProfile: (input: ProfileUpdate) => requestJson("account/profile", input, "PATCH"),
  uploadAvatar: (file: File) => requestFile("account/avatar", file),
  changePassword: (input: PasswordChangeValue) => requestJson("account/change-password", input),
};
