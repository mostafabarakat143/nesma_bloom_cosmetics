import { z } from "zod";

const PG_INT_MAX = 2_147_483_647;

const orderItemInputSchema = z
  .object({
    productId: z.string().uuid(),
    quantity: z.number().int().min(1).max(100),
  })
  .strict();

export const createOrderBodySchema = z
  .object({
    items: z
      .array(orderItemInputSchema)
      .min(1, "Order must include at least one item")
      .max(50, "Order may include at most 50 distinct products"),
  })
  .strict()
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < value.items.length; i += 1) {
      const id = value.items[i].productId;
      if (seen.has(id)) {
        ctx.addIssue({
          code: "custom",
          message: "Duplicate product IDs are not allowed",
          path: ["items", i, "productId"],
        });
        return;
      }
      seen.add(id);
    }
  });

export const orderIdParamsSchema = z
  .object({
    id: z.string().uuid(),
  })
  .strict();

export const listOrdersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z
      .enum(["PENDING", "CONFIRMED", "FULFILLED", "CANCELLED", "ALL"])
      .default("ALL"),
    userId: z.string().uuid().optional(),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const listMyOrdersQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    status: z
      .enum(["PENDING", "CONFIRMED", "FULFILLED", "CANCELLED", "ALL"])
      .default("ALL"),
    sortOrder: z.enum(["asc", "desc"]).default("desc"),
  })
  .strict();

export const updateOrderStatusBodySchema = z
  .object({
    status: z.enum(["CONFIRMED", "FULFILLED"]),
  })
  .strict();

export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
export type ListMyOrdersQuery = z.infer<typeof listMyOrdersQuerySchema>;
export type UpdateOrderStatusBody = z.infer<typeof updateOrderStatusBodySchema>;

export { PG_INT_MAX };
