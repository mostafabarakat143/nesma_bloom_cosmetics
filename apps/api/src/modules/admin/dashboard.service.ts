import { Prisma } from "../../generated/prisma/client.js";

import type { Database } from "../../config/database.js";
import type { DashboardQuery } from "./dashboard.schema.js";

const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "FULFILLED",
  "CANCELLED",
] as const;

export type DashboardDto = {
  totals: {
    products: number;
    users: number;
    categories: number;
    subcategories: number;
    orders: number;
  };
  ordersByStatus: Record<(typeof ORDER_STATUSES)[number], number>;
  ordersOverTime: Array<{ period: string; count: number }>;
  range: {
    from: string | null;
    to: string | null;
    bucket: DashboardQuery["bucket"];
  };
};

function orderDateWhere(query: DashboardQuery): Prisma.OrderWhereInput {
  if (!query.from && !query.to) {
    return {};
  }

  return {
    createdAt: {
      ...(query.from ? { gte: query.from } : {}),
      ...(query.to ? { lte: query.to } : {}),
    },
  };
}

async function ordersOverTime(
  prisma: Database,
  query: DashboardQuery,
): Promise<Array<{ period: string; count: number }>> {
  const filters: Prisma.Sql[] = [Prisma.sql`TRUE`];
  if (query.from) {
    filters.push(Prisma.sql`"created_at" >= ${query.from}`);
  }
  if (query.to) {
    filters.push(Prisma.sql`"created_at" <= ${query.to}`);
  }

  const where = Prisma.join(filters, " AND ");
  const rows =
    query.bucket === "day"
      ? await prisma.$queryRaw<Array<{ period: string; count: number }>>(
          Prisma.sql`
            SELECT to_char(
                     date_trunc('day', "created_at" AT TIME ZONE 'UTC'),
                     'YYYY-MM-DD'
                   ) AS period,
                   COUNT(*)::int AS count
            FROM "orders"
            WHERE ${where}
            GROUP BY 1
            ORDER BY 1 ASC
          `,
        )
      : await prisma.$queryRaw<Array<{ period: string; count: number }>>(
          Prisma.sql`
            SELECT to_char(
                     date_trunc('month', "created_at" AT TIME ZONE 'UTC'),
                     'YYYY-MM'
                   ) AS period,
                   COUNT(*)::int AS count
            FROM "orders"
            WHERE ${where}
            GROUP BY 1
            ORDER BY 1 ASC
          `,
        );

  return rows.map((row) => ({
    period: row.period,
    count: Number(row.count),
  }));
}

export async function getAdminDashboard(
  prisma: Database,
  query: DashboardQuery,
): Promise<DashboardDto> {
  const orderWhere = orderDateWhere(query);

  const [
    products,
    users,
    categories,
    subcategories,
    orders,
    statusGroups,
    series,
  ] = await Promise.all([
    prisma.product.count(),
    prisma.user.count(),
    prisma.category.count(),
    prisma.subcategory.count(),
    prisma.order.count({ where: orderWhere }),
    prisma.order.groupBy({
      by: ["status"],
      where: orderWhere,
      _count: { _all: true },
    }),
    ordersOverTime(prisma, query),
  ]);

  const ordersByStatus = {
    PENDING: 0,
    CONFIRMED: 0,
    FULFILLED: 0,
    CANCELLED: 0,
  };
  for (const group of statusGroups) {
    ordersByStatus[group.status] = group._count._all;
  }

  return {
    totals: { products, users, categories, subcategories, orders },
    ordersByStatus,
    ordersOverTime: series,
    range: {
      from: query.from ? query.from.toISOString() : null,
      to: query.to ? query.to.toISOString() : null,
      bucket: query.bucket,
    },
  };
}
