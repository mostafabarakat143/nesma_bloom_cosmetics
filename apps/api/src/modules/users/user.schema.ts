import { z } from "zod";

import { positiveIntIdSchema } from "../../common/validation/ids.js";

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

export const userIdParamsSchema = z
  .object({
    id: positiveIntIdSchema,
  })
  .strict();

export const listUsersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    role: z.enum(["CUSTOMER", "ADMIN"]).optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
    sortBy: z.enum(["email", "createdAt", "role", "status"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const updateUserBodySchema = z
  .object({
    role: z.enum(["CUSTOMER", "ADMIN"]).optional(),
    status: z.enum(["ACTIVE", "DISABLED"]).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required.",
  );

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
export type UpdateUserBody = z.infer<typeof updateUserBodySchema>;
