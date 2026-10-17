import { z } from "zod";

export const updateProfileBodySchema = z
  .object({
    firstName: z.string().trim().min(1).max(100).nullable().optional(),
    lastName: z.string().trim().min(1).max(100).nullable().optional(),
    phone: z.string().trim().min(3).max(30).nullable().optional(),
    avatarUrl: z.string().trim().url().max(2048).nullable().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one profile field is required.",
  );

export type UpdateProfileBody = z.infer<typeof updateProfileBodySchema>;
