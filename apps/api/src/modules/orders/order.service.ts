import { createHash } from "node:crypto";

import type { Request } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { Prisma, type OrderStatus } from "../../generated/prisma/client.js";
import type { Database } from "../../config/database.js";
import { isPublicProductVisible } from "../categories/catalog-visibility.js";
import { toOrderDto, type OrderDto } from "./order.mapper.js";
import {
  completeOrderIdempotencyKey,
  createOrderWithItems,
  decrementStockIfAvailable,
  deleteExpiredOrderIdempotencyKey,
  findCheckoutProducts,
  findOrderById,
  findOrderIdempotencyKey,
  findOrdersPage,
  findUserStatus,
  incrementStockIfSafe,
  lockCategoriesForUpdate,
  lockProductsForUpdate,
  lockSubcategoriesForUpdate,
  transitionOrderStatus,
  tryInsertOrderIdempotencyKey,
  type CheckoutProduct,
  type TxClient,
} from "./order.repository.js";
import {
  PG_INT_MAX,
  type CreateOrderBody,
  type ListMyOrdersQuery,
  type ListOrdersQuery,
  type UpdateOrderStatusBody,
} from "./order.schema.js";

type AuthUser = NonNullable<Request["user"]>;

export type PaginatedOrders = {
  items: OrderDto[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
};

const TX_OPTIONS = {
  maxWait: 5_000,
  timeout: 15_000,
  isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
} as const;

const MAX_TX_RETRIES = 3;

function isRetryableTransactionError(error: unknown): boolean {
  if (error instanceof AppError) {
    return false;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2034"
  ) {
    return true;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("deadlock") ||
      message.includes("could not serialize") ||
      message.includes("serialization failure")
    );
  }

  return false;
}

async function withTransactionRetry<T>(
  run: () => Promise<T>,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_TX_RETRIES; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (!isRetryableTransactionError(error) || attempt === MAX_TX_RETRIES - 1) {
        throw error;
      }
    }
  }
  throw lastError;
}

function multiplyMinor(unit: number, quantity: number): number {
  if (!Number.isInteger(unit) || !Number.isInteger(quantity)) {
    throw AppError.badRequest("Invalid monetary calculation");
  }
  if (unit < 0 || quantity < 1) {
    throw AppError.badRequest("Invalid monetary calculation");
  }
  if (unit > 0 && quantity > Math.floor(PG_INT_MAX / unit)) {
    throw AppError.badRequest("Line total exceeds allowed integer range");
  }
  const line = unit * quantity;
  if (!Number.isSafeInteger(line) || line > PG_INT_MAX) {
    throw AppError.badRequest("Line total exceeds allowed integer range");
  }
  return line;
}

function addMinor(total: number, line: number): number {
  if (total > PG_INT_MAX - line) {
    throw AppError.badRequest("Order total exceeds allowed integer range");
  }
  const next = total + line;
  if (!Number.isSafeInteger(next)) {
    throw AppError.badRequest("Order total exceeds allowed integer range");
  }
  return next;
}

function assertPurchasable(product: CheckoutProduct): void {
  if (
    !isPublicProductVisible({
      productStatus: product.status,
      productIsAvailable: product.isAvailable,
      parentSubcategoryStatus: product.subcategory.status,
      parentCategoryStatus: product.subcategory.category.status,
    })
  ) {
    throw AppError.conflict(
      "One or more products are not available for purchase",
    );
  }
}

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_IDEMPOTENCY_INSERT_ATTEMPTS = 3;

export function parseIdempotencyKey(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw AppError.badRequest(
      "Idempotency-Key header is required",
      undefined,
      "VALIDATION_ERROR",
    );
  }
  const key = raw.trim();
  if (key.length > 128 || !/^[\x21-\x7E]+$/.test(key)) {
    throw AppError.badRequest(
      "Idempotency-Key must be 1–128 printable ASCII characters",
      undefined,
      "VALIDATION_ERROR",
    );
  }
  return key;
}

export function hashOrderCreateRequest(
  items: CreateOrderBody["items"],
): string {
  const canonical = [...items]
    .map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
    }))
    .sort((a, b) => a.productId - b.productId);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}

async function executeCheckout(
  tx: TxClient,
  userId: number,
  items: CreateOrderBody["items"],
): Promise<OrderDto> {
  const quantityByProductId = new Map(
    items.map((item) => [item.productId, item.quantity]),
  );
  const sortedProductIds = [...quantityByProductId.keys()].sort((a, b) => a - b);

  await lockProductsForUpdate(tx, sortedProductIds);

  let products = await findCheckoutProducts(tx, sortedProductIds);
  if (products.length !== sortedProductIds.length) {
    throw AppError.notFound("Product not found");
  }

  const subcategoryIds = [
    ...new Set(products.map((p) => p.subcategory.id)),
  ].sort((a, b) => a - b);
  const categoryIds = [
    ...new Set(products.map((p) => p.subcategory.category.id)),
  ].sort((a, b) => a - b);

  await lockSubcategoriesForUpdate(tx, subcategoryIds);
  await lockCategoriesForUpdate(tx, categoryIds);

  products = await findCheckoutProducts(tx, sortedProductIds);
  if (products.length !== sortedProductIds.length) {
    throw AppError.notFound("Product not found");
  }

  for (const product of products) {
    assertPurchasable(product);
  }

  const productById = new Map(products.map((p) => [p.id, p]));

  let totalMinor = 0;
  const orderItems = sortedProductIds.map((productId) => {
    const product = productById.get(productId)!;
    const quantity = quantityByProductId.get(productId)!;
    const unitPriceMinor = product.priceMinor;
    const lineTotalMinor = multiplyMinor(unitPriceMinor, quantity);
    totalMinor = addMinor(totalMinor, lineTotalMinor);

    return {
      productId,
      productNameSnapshot: product.name,
      productSkuSnapshot: product.sku,
      unitPriceMinor,
      quantity,
      lineTotalMinor,
    };
  });

  for (const productId of sortedProductIds) {
    const quantity = quantityByProductId.get(productId)!;
    const count = await decrementStockIfAvailable(tx, productId, quantity);
    if (count !== 1) {
      throw AppError.conflict("Insufficient stock.");
    }
  }

  const order = await createOrderWithItems(tx, {
    userId,
    totalMinor,
    items: orderItems,
  });
  return toOrderDto(order);
}

export type CreateOrderResult = {
  order: OrderDto;
  created: boolean;
};

/**
 * Create order with required Idempotency-Key.
 * Concurrency gate: INSERT … ON CONFLICT DO NOTHING on (user_id, key).
 * PROCESSING rows are never committed (full rollback on failure).
 */
async function createOrderInTransaction(
  prisma: Database,
  userId: number,
  items: CreateOrderBody["items"],
  idempotencyKey: string,
): Promise<CreateOrderResult> {
  const requestHash = hashOrderCreateRequest(items);

  return prisma.$transaction(async (tx: TxClient) => {
    for (let attempt = 0; attempt < MAX_IDEMPOTENCY_INSERT_ATTEMPTS; attempt += 1) {
      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + IDEMPOTENCY_TTL_MS);

      const keyId = await tryInsertOrderIdempotencyKey(tx, {
        userId,
        key: idempotencyKey,
        requestHash,
        createdAt,
        expiresAt,
      });

      if (keyId !== null) {
        const order = await executeCheckout(tx, userId, items);
        await completeOrderIdempotencyKey(tx, keyId, order.id);
        return { order, created: true };
      }

      // Conflict — transaction is still healthy (ON CONFLICT DO NOTHING).
      const existing = await findOrderIdempotencyKey(tx, userId, idempotencyKey);
      if (!existing) {
        continue;
      }

      if (existing.expiresAt.getTime() <= Date.now()) {
        await deleteExpiredOrderIdempotencyKey(tx, userId, idempotencyKey);
        continue;
      }

      if (existing.status === "COMPLETED" && existing.orderId) {
        if (existing.requestHash !== requestHash) {
          throw AppError.conflict(
            "Idempotency-Key was reused with a different request payload",
          );
        }
        const order = await findOrderById(tx, existing.orderId);
        if (!order) {
          throw AppError.conflict(
            "Idempotency-Key refers to a missing order",
          );
        }
        return { order: toOrderDto(order), created: false };
      }

      // Should not observe committed PROCESSING; treat as conflict.
      throw AppError.conflict("Idempotency-Key request is already in progress");
    }

    throw AppError.conflict("Unable to acquire idempotency lock");
  }, TX_OPTIONS);
}

export async function createOrderService(
  prisma: Database,
  user: AuthUser,
  input: CreateOrderBody,
  idempotencyKeyRaw: unknown,
): Promise<CreateOrderResult> {
  if (user.role !== "CUSTOMER") {
    throw AppError.forbidden("Only customers may create orders");
  }

  const status = await findUserStatus(prisma, user.id);
  if (!status) {
    throw AppError.unauthorized("Authentication required");
  }
  if (status === "DISABLED") {
    throw AppError.forbidden("Account is disabled");
  }

  const idempotencyKey = parseIdempotencyKey(idempotencyKeyRaw);

  return withTransactionRetry(() =>
    createOrderInTransaction(prisma, user.id, input.items, idempotencyKey),
  );
}

export async function listMyOrders(
  prisma: Database,
  user: AuthUser,
  query: ListMyOrdersQuery,
): Promise<PaginatedOrders> {
  const { items, totalItems } = await findOrdersPage(prisma, {
    userId: user.id,
    status: query.status,
    sortOrder: query.sortOrder,
    page: query.page,
    pageSize: query.pageSize,
  });

  const totalPages =
    totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

  return {
    items: items.map(toOrderDto),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function listAllOrders(
  prisma: Database,
  query: ListOrdersQuery,
): Promise<PaginatedOrders> {
  const { items, totalItems } = await findOrdersPage(prisma, {
    userId: query.userId,
    status: query.status,
    sortOrder: query.sortOrder,
    page: query.page,
    pageSize: query.pageSize,
  });

  const totalPages =
    totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

  return {
    items: items.map(toOrderDto),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}

export async function getOrderById(
  prisma: Database,
  id: number,
  user: AuthUser,
): Promise<OrderDto> {
  const order = await findOrderById(prisma, id);
  if (!order) {
    throw AppError.notFound("Order not found");
  }

  if (user.role !== "ADMIN" && order.userId !== user.id) {
    throw AppError.notFound("Order not found");
  }

  return toOrderDto(order);
}

async function cancelOrderInTransaction(
  prisma: Database,
  id: number,
  allowedFrom: OrderStatus[],
): Promise<OrderDto> {
  return prisma.$transaction(async (tx) => {
    const count = await transitionOrderStatus(
      tx,
      id,
      allowedFrom,
      "CANCELLED",
    );

    if (count === 1) {
      const order = await findOrderById(tx, id);
      if (!order) {
        throw AppError.notFound("Order not found");
      }

      const restockIds = [...order.items]
        .map((item) => item.productId)
        .sort((a, b) => a - b);
      const quantityByProduct = new Map<number, number>();
      for (const item of order.items) {
        quantityByProduct.set(
          item.productId,
          (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
        );
      }

      for (const productId of restockIds) {
        const quantity = quantityByProduct.get(productId)!;
        const updated = await incrementStockIfSafe(tx, productId, quantity);
        if (updated !== 1) {
          throw AppError.conflict(
            "Unable to restore stock without exceeding inventory limits",
          );
        }
      }

      return toOrderDto(order);
    }

    const current = await findOrderById(tx, id);
    if (!current) {
      throw AppError.notFound("Order not found");
    }
    if (current.status === "CANCELLED") {
      // Lost the race to another cancel — already restocked once.
      return toOrderDto(current);
    }
    throw AppError.conflict("Order cannot be cancelled in its current status");
  }, TX_OPTIONS);
}

export async function cancelOrderService(
  prisma: Database,
  id: number,
  user: AuthUser,
): Promise<OrderDto> {
  const existing = await findOrderById(prisma, id);
  if (!existing) {
    throw AppError.notFound("Order not found");
  }

  // Ownership / admin check before revealing cancellation status semantics.
  if (user.role !== "ADMIN" && existing.userId !== user.id) {
    throw AppError.notFound("Order not found");
  }

  if (existing.status === "CANCELLED") {
    return toOrderDto(existing);
  }

  if (existing.status === "FULFILLED") {
    throw AppError.conflict("Fulfilled orders cannot be cancelled");
  }

  const allowedFrom: OrderStatus[] =
    user.role === "ADMIN" ? ["PENDING", "CONFIRMED"] : ["PENDING"];

  if (!allowedFrom.includes(existing.status)) {
    throw AppError.conflict("Order cannot be cancelled in its current status");
  }

  return withTransactionRetry(() =>
    cancelOrderInTransaction(prisma, id, allowedFrom),
  );
}

export async function updateOrderStatusService(
  prisma: Database,
  id: number,
  input: UpdateOrderStatusBody,
): Promise<OrderDto> {
  const existing = await findOrderById(prisma, id);
  if (!existing) {
    throw AppError.notFound("Order not found");
  }

  const target = input.status;
  let from: OrderStatus;

  if (target === "CONFIRMED") {
    from = "PENDING";
  } else if (target === "FULFILLED") {
    from = "CONFIRMED";
  } else {
    throw AppError.badRequest("Invalid status transition");
  }

  if (existing.status === target) {
    return toOrderDto(existing);
  }

  if (existing.status !== from) {
    throw AppError.conflict("Invalid order status transition");
  }

  return withTransactionRetry(async () => {
    const updated = await prisma.$transaction(async (tx) => {
      const count = await transitionOrderStatus(tx, id, from, target);
      if (count !== 1) {
        const current = await findOrderById(tx, id);
        if (!current) {
          throw AppError.notFound("Order not found");
        }
        if (current.status === target) {
          return current;
        }
        throw AppError.conflict("Invalid order status transition");
      }
      const order = await findOrderById(tx, id);
      if (!order) {
        throw AppError.notFound("Order not found");
      }
      return order;
    }, TX_OPTIONS);

    return toOrderDto(updated);
  });
}
