import { z } from "zod";

import { normalizeSlug } from "../../common/utils/slug.js";
import {
  positiveIntIdField,
  positiveIntIdSchema,
} from "../../common/validation/ids.js";

/** PostgreSQL INTEGER upper bound (signed 32-bit). */
const PG_INT_MAX = 2_147_483_647;

const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(220)
  .transform((value) => normalizeSlug(value))
  .refine(
    (value) => value.length > 0 && value.length <= 220,
    "Slug must be 1–220 characters after normalization",
  )
  .refine(
    (value) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value),
    "Slug must be lowercase kebab-case (a-z, 0-9, hyphens)",
  );

const skuSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .transform((value) => value.toUpperCase())
  .refine(
    (value) => /^[A-Z0-9]+(?:[_-][A-Z0-9]+)*$/.test(value),
    "SKU must be uppercase alphanumeric with optional hyphens or underscores",
  );

const nonNegativeInt = z.coerce
  .number()
  .int()
  .min(0)
  .max(PG_INT_MAX);

const priceMinorSchema = z
  .number()
  .int()
  .min(0)
  .max(PG_INT_MAX);

const stockQtySchema = z.number().int().min(0).max(PG_INT_MAX);

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
  .string()
  .trim()
  .min(1)
  .max(2048)
  .refine(isSafeHttpUrl, "Image URL must be http(s) without credentials");

export const productIdParamsSchema = z
  .object({
    id: positiveIntIdSchema,
  })
  .strict();

export const productImageParamsSchema = z
  .object({
    id: positiveIntIdSchema,
    imageId: positiveIntIdSchema,
  })
  .strict();

export const listProductsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    categoryId: positiveIntIdSchema.optional(),
    subcategoryId: positiveIntIdSchema.optional(),
    minPriceMinor: nonNegativeInt.optional(),
    maxPriceMinor: nonNegativeInt.optional(),
    availability: z
      .enum(["AVAILABLE", "UNAVAILABLE", "ALL"])
      .default("AVAILABLE"),
    status: z.enum(["ACTIVE", "ARCHIVED", "ALL"]).default("ACTIVE"),
    sortBy: z.enum(["name", "priceMinor", "createdAt"]).default("createdAt"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict()
  .refine(
    (value) =>
      value.minPriceMinor === undefined ||
      value.maxPriceMinor === undefined ||
      value.minPriceMinor <= value.maxPriceMinor,
    {
      message: "minPriceMinor must be less than or equal to maxPriceMinor",
      path: ["minPriceMinor"],
    },
  );

export const createProductBodySchema = z
  .object({
    name: z
      .string({ error: () => "Product name is required." })
      .trim()
      .min(1, "Product name is required.")
      .max(200),
    subcategoryId: positiveIntIdField("Subcategory ID"),
    sku: skuSchema,
    priceMinor: priceMinorSchema,
    stockQty: stockQtySchema,
    slug: slugSchema.optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    isAvailable: z.boolean().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .strict();

export const updateProductBodySchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    subcategoryId: positiveIntIdSchema.optional(),
    sku: skuSchema.optional(),
    priceMinor: priceMinorSchema.optional(),
    stockQty: stockQtySchema.optional(),
    slug: slugSchema.optional(),
    description: z.string().trim().max(10000).nullable().optional(),
    isAvailable: z.boolean().optional(),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required.",
  );

export const createProductImageBodySchema = z
  .object({
    url: imageUrlSchema,
    altText: z.string().trim().max(255).nullable().optional(),
    sortOrder: z.number().int().min(0).max(PG_INT_MAX).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict();

export const updateProductImageBodySchema = z
  .object({
    url: imageUrlSchema.optional(),
    altText: z.string().trim().max(255).nullable().optional(),
    sortOrder: z.number().int().min(0).max(PG_INT_MAX).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one field is required.",
  );

export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type CreateProductBody = z.infer<typeof createProductBodySchema>;
export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;
export type CreateProductImageBody = z.infer<
  typeof createProductImageBodySchema
>;
export type UpdateProductImageBody = z.infer<
  typeof updateProductImageBodySchema
>;
