"use client";

import { useMutation } from "@tanstack/react-query";
import { accountService } from "../services/account.service";

export function useUpdateProfile() {
  return useMutation({ mutationFn: accountService.updateProfile });
}
export function useUploadAvatar() {
  return useMutation({ mutationFn: accountService.uploadAvatar });
}
export function useChangePassword() {
  return useMutation({ mutationFn: accountService.changePassword });
}
