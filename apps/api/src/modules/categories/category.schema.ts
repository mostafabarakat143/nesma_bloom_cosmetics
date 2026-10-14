import { z } from "zod";

import { normalizeSlug } from "../../common/utils/slug.js";

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .transform((value) => normalizeSlug(value))
  .refine(
    (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    "Slug must be lowercase kebab-case (a-z, 0-9, hyphens)",
  );

export const categoryIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const listCategoriesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    sortBy: z.enum(["name", "createdAt"]).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
    status: z.enum(["ACTIVE", "ARCHIVED", "ALL"]).default("ACTIVE"),
  })
  .strict();

export const createCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    slug: slugSchema.optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .strict();

export const updateCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: slugSchema.optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;
