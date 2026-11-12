import { describe, expect, it, vi } from "vitest";

import type { Database } from "../../src/config/database.js";
import { Prisma } from "../../src/generated/prisma/client.js";
import { LastAdminError, updateUserForAdmin } from "../../src/modules/users/user.repository.js";

function databaseWithAdmin(otherAdmins = 1) {
  const user = { id: 1, role: "ADMIN", status: "ACTIVE" };
  const transaction = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
      count: vi.fn().mockResolvedValue(otherAdmins),
      update: vi.fn().mockResolvedValue({ ...user, role: "CUSTOMER" }),
    },
  };
  const $transaction = vi.fn(async (run: (tx: typeof transaction) => Promise<unknown>) => run(transaction));
  return { transaction, $transaction, prisma: { $transaction } as unknown as Database };
}

function databaseError(code: string, postgresCode?: string) {
  return new Prisma.PrismaClientKnownRequestError("Database operation failed", {
    code,
    clientVersion: "7.10.0",
    meta: postgresCode ? { code: postgresCode } : undefined,
  });
}

describe("admin update transactions", () => {
  it.each([
    ["P2034", undefined],
    ["P2010", "40P01"],
    ["P2010", "40001"],
  ])("retries a rolled-back %s transaction (%s)", async (code, postgresCode) => {
    const { prisma, $transaction, transaction } = databaseWithAdmin();
    $transaction.mockRejectedValueOnce(databaseError(code!, postgresCode));

    await expect(updateUserForAdmin(prisma, 1, { role: "CUSTOMER" }))
      .resolves.toMatchObject({ id: 1, role: "CUSTOMER" });
    expect($transaction).toHaveBeenCalledTimes(2);
    expect(transaction.user.update).toHaveBeenCalledTimes(1);
  });

  it("stops after three attempts when conflicts persist", async () => {
    const { prisma, $transaction } = databaseWithAdmin();
    const error = databaseError("P2034");
    $transaction.mockRejectedValue(error);

    await expect(updateUserForAdmin(prisma, 1, { status: "DISABLED" })).rejects.toBe(error);
    expect($transaction).toHaveBeenCalledTimes(3);
  });

  it("does not retry removing the last active admin", async () => {
    const { prisma, $transaction, transaction } = databaseWithAdmin(0);

    await expect(updateUserForAdmin(prisma, 1, { role: "CUSTOMER" })).rejects.toBeInstanceOf(LastAdminError);
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it.each([databaseError("P2002"), databaseError("P2010", "23505"), new Error("Connection failure")])(
    "does not retry unrelated errors",
    async (error) => {
      const { prisma, $transaction } = databaseWithAdmin();
      $transaction.mockRejectedValue(error);
      await expect(updateUserForAdmin(prisma, 1, { role: "CUSTOMER" })).rejects.toBe(error);
      expect($transaction).toHaveBeenCalledTimes(1);
    },
  );

  it("returns null for a missing target even when active admins exist", async () => {
    const { prisma, transaction } = databaseWithAdmin();
    transaction.$queryRaw.mockResolvedValue([{ id: 2 }]);

    await expect(updateUserForAdmin(prisma, 1, { status: "DISABLED" })).resolves.toBeNull();
    expect(transaction.user.update).not.toHaveBeenCalled();
  });
});
