import type { Request } from "express";

import { AppError } from "../../common/errors/app-error.js";
import { Prisma, type OrderStatus } from "../../generated/prisma/client.js";
import type { Database } from "../../config/database.js";
import { isPublicProductVisible } from "../categories/catalog-visibility.js";
import { toOrderDto, type OrderDto } from "./order.mapper.js";
import {
  createOrderWithItems,
  decrementStockIfAvailable,
  findCheckoutProducts,
  findOrderById,
  findOrdersPage,
  findUserStatus,
  incrementStock,
  lockCategoriesForUpdate,
  lockProductsForUpdate,
  lockSubcategoriesForUpdate,
  transitionOrderStatus,
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

async function createOrderInTransaction(
  prisma: Database,
  userId: string,
  items: CreateOrderBody["items"],
): Promise<OrderDto> {
  const quantityByProductId = new Map(
    items.map((item) => [item.productId, item.quantity]),
  );
  const sortedProductIds = [...quantityByProductId.keys()].sort();

  const order = await prisma.$transaction(async (tx: TxClient) => {
    // Lock product rows first (deterministic order) so price/status/stock
    // cannot change under us until commit. Concurrent admin updates wait.
    await lockProductsForUpdate(tx, sortedProductIds);

    let products = await findCheckoutProducts(tx, sortedProductIds);
    if (products.length !== sortedProductIds.length) {
      throw AppError.notFound("Product not found");
    }

    const subcategoryIds = [
      ...new Set(products.map((p) => p.subcategory.id)),
    ].sort();
    const categoryIds = [
      ...new Set(products.map((p) => p.subcategory.category.id)),
    ].sort();

    // Lock ancestors so archival mid-checkout cannot sneak past validation.
    await lockSubcategoriesForUpdate(tx, subcategoryIds);
    await lockCategoriesForUpdate(tx, categoryIds);

    // Re-read under locks for a consistent checkout snapshot.
    products = await findCheckoutProducts(tx, sortedProductIds);
    if (products.length !== sortedProductIds.length) {
      throw AppError.notFound("Product not found");
    }

    for (const product of products) {
      assertPurchasable(product);
    }

    const productById = new Map(products.map((p) => [p.id, p]));

    // Safe totals from locked snapshot before mutating stock.
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

    // Conditional decrements in id order — second concurrent buyer of last
    // unit gets count=0 → 409; transaction rolls back.
    for (const productId of sortedProductIds) {
      const quantity = quantityByProductId.get(productId)!;
      const count = await decrementStockIfAvailable(tx, productId, quantity);
      if (count !== 1) {
        throw AppError.conflict("Insufficient stock for one or more products");
      }
    }

    return createOrderWithItems(tx, {
      userId,
      totalMinor,
      items: orderItems,
    });
  }, TX_OPTIONS);

  return toOrderDto(order);
}

export async function createOrderService(
  prisma: Database,
  user: AuthUser,
  input: CreateOrderBody,
): Promise<OrderDto> {
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

  return withTransactionRetry(() =>
    createOrderInTransaction(prisma, user.id, input.items),
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
  id: string,
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
  id: string,
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
        .sort();
      const quantityByProduct = new Map<string, number>();
      for (const item of order.items) {
        quantityByProduct.set(
          item.productId,
          (quantityByProduct.get(item.productId) ?? 0) + item.quantity,
        );
      }

      for (const productId of restockIds) {
        await incrementStock(tx, productId, quantityByProduct.get(productId)!);
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
  id: string,
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
  id: string,
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
