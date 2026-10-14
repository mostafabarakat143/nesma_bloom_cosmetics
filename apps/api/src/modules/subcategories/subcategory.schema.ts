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

export const subcategoryIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const listSubcategoriesQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    sortBy: z.enum(["name", "createdAt"]).default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
    status: z.enum(["ACTIVE", "ARCHIVED", "ALL"]).default("ACTIVE"),
    categoryId: z.string().uuid().optional(),
  })
  .strict();

export const createSubcategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    categoryId: z.string().uuid(),
    slug: slugSchema.optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .strict();

export const updateSubcategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    categoryId: z.string().uuid().optional(),
    slug: slugSchema.optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required",
  );

export type ListSubcategoriesQuery = z.infer<
  typeof listSubcategoriesQuerySchema
>;
export type CreateSubcategoryBody = z.infer<typeof createSubcategoryBodySchema>;
export type UpdateSubcategoryBody = z.infer<typeof updateSubcategoryBodySchema>;
