import { z } from "zod";

import { normalizeSlug } from "../../common/utils/slug.js";
import { positiveIntIdSchema } from "../../common/validation/ids.js";

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
    id: positiveIntIdSchema,
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

function isSafeHttpUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return false;
  }

  if (parsed.username || parsed.password) {
    return false;
  }

  return true;
}

const imageUrlSchema = z
  .string({ error: () => "Category image URL is required." })
  .trim()
  .min(1, "Category image URL is required.")
  .max(2048)
  .refine(isSafeHttpUrl, "Image URL must be http(s) without credentials");

export const createCategoryBodySchema = z
  .object({
    name: z
      .string({ error: () => "Category name is required." })
      .trim()
      .min(1, "Category name is required.")
      .max(120),
    slug: slugSchema.optional(),
    imageUrl: imageUrlSchema,
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .strict();

export const updateCategoryBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: slugSchema.optional(),
    imageUrl: imageUrlSchema.optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required.",
  );

export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
export type CreateCategoryBody = z.infer<typeof createCategoryBodySchema>;
export type UpdateCategoryBody = z.infer<typeof updateCategoryBodySchema>;
