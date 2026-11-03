import { bearerInit, callExpress } from "@/shared/http/server";
import type { LoginInput, RegisterInput } from "../lib/credentials";
import type { ForgotPasswordRequest, ResetPasswordRequest } from "../types";

function jsonBody(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const authServerService = {
  login: (input: LoginInput) => callExpress("auth/login", jsonBody(input)),
  register: (input: RegisterInput) => callExpress("auth/register", jsonBody(input)),
  forgotPassword: (input: ForgotPasswordRequest) => callExpress("auth/forgot-password", jsonBody(input)),
  resetPassword: (input: ResetPasswordRequest) => callExpress("auth/reset-password", jsonBody(input)),
  revokeToken: (token: string) => callExpress("auth/logout", bearerInit(token, "POST")),
  getSession: (token: string) => callExpress("auth/me", bearerInit(token, "GET")),
};
