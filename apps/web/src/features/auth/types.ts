import type { LoginInput, RegisterInput } from "./lib/credentials";

export type LoginRequest = LoginInput & { next: string; };
export type RegisterRequest = RegisterInput & { next: string; };
export type ForgotPasswordRequest = { email: string; };
export type ResetPasswordRequest = { token: string; newPassword: string; };

export type LogoutResult = {
  ok: boolean;
  status: number;
  message: string | null;
};
