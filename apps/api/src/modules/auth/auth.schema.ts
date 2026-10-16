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

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
