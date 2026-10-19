import { z } from "zod";

export const registerBodySchema = z
  .object({
    email: z
      .string({ error: () => "Email is required." })
      .trim()
      .email("Please enter a valid email address.")
      .max(255),
    password: z
      .string({ error: () => "Password is required." })
      .min(8, "Password must be at least 8 characters.")
      .max(128),
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const loginBodySchema = z
  .object({
    email: z
      .string({ error: () => "Email is required." })
      .trim()
      .email("Please enter a valid email address.")
      .max(255),
    password: z
      .string({ error: () => "Password is required." })
      .min(1, "Password is required.")
      .max(128),
  })
  .strict();

export const changePasswordBodySchema = z
  .object({
    currentPassword: z
      .string({ error: () => "Current password is required." })
      .min(1, "Current password is required.")
      .max(128),
    newPassword: z
      .string({ error: () => "New password is required." })
      .min(8, "Password must be at least 8 characters.")
      .max(128),
  })
  .strict();

export const forgotPasswordBodySchema = z
  .object({
    email: z
      .string({ error: () => "Email is required." })
      .trim()
      .email("Please enter a valid email address.")
      .max(255),
  })
  .strict();

export const resetPasswordBodySchema = z
  .object({
    token: z
      .string({ error: () => "Reset token is required." })
      .trim()
      .min(20, "Reset token is required.")
      .max(200),
    newPassword: z
      .string({ error: () => "New password is required." })
      .min(8, "Password must be at least 8 characters.")
      .max(128),
  })
  .strict();

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordBodySchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordBodySchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordBodySchema>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
