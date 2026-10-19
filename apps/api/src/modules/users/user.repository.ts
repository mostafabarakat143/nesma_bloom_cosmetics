import type { Prisma, UserRole, UserStatus } from "../../generated/prisma/client.js";

import type { Database } from "../../config/database.js";
import type { ListUsersQuery } from "./user.schema.js";

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
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<Array<{ id: number }>>`
      SELECT "id" FROM "users" WHERE "id" = ${id} FOR UPDATE
    `;
    if (locked.length === 0) {
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
      await tx.$queryRaw`
        SELECT "id" FROM "users"
        WHERE "role" = 'ADMIN' AND "status" = 'ACTIVE'
        FOR UPDATE
      `;
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
}
