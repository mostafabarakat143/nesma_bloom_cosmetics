import { Prisma, type OrderStatus } from "../../generated/prisma/client.js";

import type { Database } from "../../config/database.js";
import type { OrderWithItems } from "./order.mapper.js";

export type TxClient = Parameters<
  Parameters<Database["$transaction"]>[0]
>[0];

const orderInclude = {
  items: {
    orderBy: [{ productSkuSnapshot: "asc" as const }, { id: "asc" as const }],
  },
} satisfies Prisma.OrderInclude;

export type CheckoutProduct = {
  id: string;
  name: string;
  sku: string;
  priceMinor: number;
  stockQty: number;
  status: "ACTIVE" | "ARCHIVED";
  isAvailable: boolean;
  subcategoryId: string;
  subcategory: {
    id: string;
    status: "ACTIVE" | "ARCHIVED";
    categoryId: string;
    category: {
      id: string;
      status: "ACTIVE" | "ARCHIVED";
    };
  };
};

/**
 * Row-lock products in deterministic id order so checkout sees a consistent
 * snapshot and concurrent admin price/status updates wait until commit.
 */
export async function lockProductsForUpdate(
  tx: TxClient,
  productIds: string[],
): Promise<void> {
  if (productIds.length === 0) {
    return;
  }

  await tx.$queryRaw`
    SELECT id
    FROM products
    WHERE id IN (${Prisma.join(productIds)})
    ORDER BY id
    FOR UPDATE
  `;
}

export async function lockSubcategoriesForUpdate(
  tx: TxClient,
  subcategoryIds: string[],
): Promise<void> {
  if (subcategoryIds.length === 0) {
    return;
  }

  await tx.$queryRaw`
    SELECT id
    FROM subcategories
    WHERE id IN (${Prisma.join(subcategoryIds)})
    ORDER BY id
    FOR UPDATE
  `;
}

export async function lockCategoriesForUpdate(
  tx: TxClient,
  categoryIds: string[],
): Promise<void> {
  if (categoryIds.length === 0) {
    return;
  }

  await tx.$queryRaw`
    SELECT id
    FROM categories
    WHERE id IN (${Prisma.join(categoryIds)})
    ORDER BY id
    FOR UPDATE
  `;
}

export async function findCheckoutProducts(
  tx: TxClient,
  productIds: string[],
): Promise<CheckoutProduct[]> {
  return tx.product.findMany({
    where: { id: { in: productIds } },
    select: {
      id: true,
      name: true,
      sku: true,
      priceMinor: true,
      stockQty: true,
      status: true,
      isAvailable: true,
      subcategoryId: true,
      subcategory: {
        select: {
          id: true,
          status: true,
          categoryId: true,
          category: {
            select: {
              id: true,
              status: true,
            },
          },
        },
      },
    },
  });
}

export async function decrementStockIfAvailable(
  tx: TxClient,
  productId: string,
  quantity: number,
): Promise<number> {
  const result = await tx.product.updateMany({
    where: {
      id: productId,
      status: "ACTIVE",
      isAvailable: true,
      stockQty: { gte: quantity },
    },
    data: {
      stockQty: { decrement: quantity },
    },
  });
  return result.count;
}

const PG_INT_MAX = 2_147_483_647;

/**
 * Restock with INTEGER overflow guard. Uses a conditional update so overflow
 * cannot partially apply; caller should treat count !== 1 as failure.
 */
export async function incrementStockIfSafe(
  tx: TxClient,
  productId: string,
  quantity: number,
): Promise<number> {
  const product = await tx.product.findUnique({
    where: { id: productId },
    select: { stockQty: true },
  });
  if (!product) {
    return 0;
  }
  if (product.stockQty > PG_INT_MAX - quantity) {
    return 0;
  }

  const result = await tx.product.updateMany({
    where: {
      id: productId,
      stockQty: { lte: PG_INT_MAX - quantity },
    },
    data: {
      stockQty: { increment: quantity },
    },
  });
  return result.count;
}

export async function tryInsertOrderIdempotencyKey(
  tx: TxClient,
  data: {
    id: string;
    userId: string;
    key: string;
    requestHash: string;
    createdAt: Date;
    expiresAt: Date;
  },
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO order_idempotency_keys (
      id, user_id, key, request_hash, status, order_id, expires_at, created_at, updated_at
    ) VALUES (
      ${data.id}::uuid,
      ${data.userId}::uuid,
      ${data.key},
      ${data.requestHash},
      'PROCESSING'::idempotency_record_status,
      NULL,
      ${data.expiresAt},
      ${data.createdAt},
      ${data.createdAt}
    )
    ON CONFLICT (user_id, key) DO NOTHING
    RETURNING id
  `;
  return rows.length === 1;
}

export async function findOrderIdempotencyKey(
  tx: TxClient,
  userId: string,
  key: string,
) {
  return tx.orderIdempotencyKey.findUnique({
    where: {
      userId_key: { userId, key },
    },
  });
}

export async function deleteExpiredOrderIdempotencyKey(
  tx: TxClient,
  userId: string,
  key: string,
): Promise<number> {
  const result = await tx.orderIdempotencyKey.deleteMany({
    where: {
      userId,
      key,
      expiresAt: { lt: new Date() },
    },
  });
  return result.count;
}

export async function completeOrderIdempotencyKey(
  tx: TxClient,
  id: string,
  orderId: string,
): Promise<void> {
  await tx.orderIdempotencyKey.update({
    where: { id },
    data: {
      status: "COMPLETED",
      orderId,
    },
  });
}

export async function createOrderWithItems(
  tx: TxClient,
  data: {
    userId: string;
    totalMinor: number;
    items: Array<{
      productId: string;
      productNameSnapshot: string;
      productSkuSnapshot: string;
      unitPriceMinor: number;
      quantity: number;
      lineTotalMinor: number;
    }>;
  },
): Promise<OrderWithItems> {
  return tx.order.create({
    data: {
      userId: data.userId,
      status: "PENDING",
      totalMinor: data.totalMinor,
      currency: "EGP",
      items: {
        create: data.items,
      },
    },
    include: orderInclude,
  });
}

export async function findOrderById(
  prisma: Database | TxClient,
  id: string,
): Promise<OrderWithItems | null> {
  return prisma.order.findUnique({
    where: { id },
    include: orderInclude,
  });
}

export type OrderListFilters = {
  userId?: string;
  status: OrderStatus | "ALL";
  sortOrder: "asc" | "desc";
  page: number;
  pageSize: number;
};

export async function findOrdersPage(
  prisma: Database,
  filters: OrderListFilters,
): Promise<{ items: OrderWithItems[]; totalItems: number }> {
  const where: Prisma.OrderWhereInput = {};
  if (filters.userId) {
    where.userId = filters.userId;
  }
  if (filters.status !== "ALL") {
    where.status = filters.status;
  }

  const skip = (filters.page - 1) * filters.pageSize;

  const [totalItems, items] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: filters.sortOrder }, { id: "asc" }],
      skip,
      take: filters.pageSize,
      include: orderInclude,
    }),
  ]);

  return { items, totalItems };
}

export async function transitionOrderStatus(
  tx: TxClient,
  id: string,
  from: OrderStatus | OrderStatus[],
  to: OrderStatus,
): Promise<number> {
  const result = await tx.order.updateMany({
    where: {
      id,
      status: Array.isArray(from) ? { in: from } : from,
    },
    data: { status: to },
  });
  return result.count;
}

export async function findUserStatus(
  prisma: Database,
  userId: string,
): Promise<"ACTIVE" | "DISABLED" | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });
  return user?.status ?? null;
}
