import { requestJson } from "@/shared/http/client";
import { getBrowserApiUrl, SAME_ORIGIN_HEADER, SAME_ORIGIN_VALUE } from "@/shared/http/request";
import { responseErrorMessage } from "@/shared/errors";

import type { ForgotPasswordRequest, LoginRequest, LogoutResult, RegisterRequest, ResetPasswordRequest } from "../types";

export const authService = {
  login: (input: LoginRequest) => requestJson("auth/login", input),
  register: (input: RegisterRequest) => requestJson("auth/register", input),
  forgotPassword: (input: ForgotPasswordRequest) => requestJson("auth/forgot-password", input),
  resetPassword: (input: ResetPasswordRequest) => requestJson("auth/reset-password", input),
  // Logout has no JSON body and keeps its original status/error handling.
  async logout(): Promise<LogoutResult> {
    const response = await fetch(getBrowserApiUrl("auth/logout"), {
      method: "POST",
      headers: { accept: "application/json", [SAME_ORIGIN_HEADER]: SAME_ORIGIN_VALUE },
      cache: "no-store",
    });
    const payload: unknown = await response.json().catch(() => null);
    const message = responseErrorMessage(payload);
    return { ok: response.ok, status: response.status, message };
  },
};
