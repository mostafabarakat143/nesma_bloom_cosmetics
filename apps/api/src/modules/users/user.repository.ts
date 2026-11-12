import { setTimeout as delay } from "node:timers/promises";

import { Prisma, type UserRole, type UserStatus } from "../../generated/prisma/client.js";

import type { Database } from "../../config/database.js";
import type { ListUsersQuery } from "./user.schema.js";

const MAX_ADMIN_UPDATE_ATTEMPTS = 3;

const userAdminSelect = {
  id: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  profile: {
    select: {
      firstName: true,
      lastName: true,
      phone: true,
      avatarUrl: true,
    },
  },
} satisfies Prisma.UserSelect;

export type AdminUserRecord = Prisma.UserGetPayload<{
  select: typeof userAdminSelect;
}>;

function buildWhere(
  filters: Pick<ListUsersQuery, "search" | "role" | "status">,
): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (filters.role) {
    where.role = filters.role;
  }
  if (filters.status) {
    where.status = filters.status;
  }
  if (filters.search) {
    where.OR = [
      { email: { contains: filters.search, mode: "insensitive" } },
      {
        profile: {
          is: { firstName: { contains: filters.search, mode: "insensitive" } },
        },
      },
      {
        profile: {
          is: { lastName: { contains: filters.search, mode: "insensitive" } },
        },
      },
    ];
  }

  return where;
}

export async function findUsersPage(
  prisma: Database,
  query: ListUsersQuery,
): Promise<{ items: AdminUserRecord[]; totalItems: number }> {
  const where = buildWhere(query);
  const skip = (query.page - 1) * query.pageSize;

  const [totalItems, items] = await prisma.$transaction([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: userAdminSelect,
      orderBy: [{ [query.sortBy]: query.sortOrder }, { id: "asc" }],
      skip,
      take: query.pageSize,
    }),
  ]);

  return { items, totalItems };
}

export async function findUserForAdmin(
  prisma: Database,
  id: number,
): Promise<AdminUserRecord | null> {
  return prisma.user.findUnique({
    where: { id },
    select: userAdminSelect,
  });
}

export class LastAdminError extends Error {
  constructor() {
    super("Cannot remove the last active admin");
    this.name = "LastAdminError";
  }
}

export async function updateUserForAdmin(
  prisma: Database,
  id: number,
  data: { role?: UserRole; status?: UserStatus },
): Promise<AdminUserRecord | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT "id" FROM "users"
          WHERE "id" = ${id} OR ("role" = 'ADMIN' AND "status" = 'ACTIVE')
          ORDER BY "id"
          FOR UPDATE
        `;
        if (!locked.some((user) => user.id === id)) {
          return null;
        }

        const current = await tx.user.findUnique({
          where: { id },
          select: { id: true, role: true, status: true },
        });
        if (!current) {
          return null;
        }

        const nextRole = data.role ?? current.role;
        const nextStatus = data.status ?? current.status;
        const wasActiveAdmin =
          current.role === "ADMIN" && current.status === "ACTIVE";
        const staysActiveAdmin = nextRole === "ADMIN" && nextStatus === "ACTIVE";

        if (wasActiveAdmin && !staysActiveAdmin) {
          const others = await tx.user.count({
            where: {
              role: "ADMIN",
              status: "ACTIVE",
              id: { not: current.id },
            },
          });
          if (others === 0) {
            throw new LastAdminError();
          }
        }

        return tx.user.update({
          where: { id },
          data: {
            ...(data.role !== undefined ? { role: data.role } : {}),
            ...(data.status !== undefined ? { status: data.status } : {}),
          },
          select: userAdminSelect,
        });
      });
    } catch (error) {
      if (attempt >= MAX_ADMIN_UPDATE_ATTEMPTS - 1 || !isRetryableTransactionError(error)) {
        throw error;
      }
      await delay(25 * 2 ** attempt + Math.floor(Math.random() * 25));
    }
  }
}

function isRetryableTransactionError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }
  return (
    error.code === "P2034" ||
    (error.code === "P2010" &&
      (error.meta?.code === "40P01" || error.meta?.code === "40001"))
  );
}
