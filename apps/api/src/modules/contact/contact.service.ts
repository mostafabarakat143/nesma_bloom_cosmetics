import type { ContactMessage } from "../../generated/prisma/client.js";

import type { Database } from "../../config/database.js";
import type { CreateContactBody, ListContactQuery } from "./contact.schema.js";

export type ContactMessageDto = {
  id: number;
  name: string;
  phone: string;
  email: string;
  message: string;
  createdAt: string;
};

function toContactDto(row: ContactMessage): ContactMessageDto {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createContactMessage(
  prisma: Database,
  input: CreateContactBody,
): Promise<ContactMessageDto> {
  const row = await prisma.contactMessage.create({
    data: {
      name: input.name,
      phone: input.phone,
      email: input.email,
      message: input.message,
    },
  });
  return toContactDto(row);
}

export async function listContactMessages(
  prisma: Database,
  query: ListContactQuery,
): Promise<{
  items: ContactMessageDto[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}> {
  const skip = (query.page - 1) * query.pageSize;
  const [totalItems, rows] = await prisma.$transaction([
    prisma.contactMessage.count(),
    prisma.contactMessage.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip,
      take: query.pageSize,
    }),
  ]);

  const totalPages =
    totalItems === 0 ? 0 : Math.ceil(totalItems / query.pageSize);

  return {
    items: rows.map(toContactDto),
    meta: {
      page: query.page,
      pageSize: query.pageSize,
      totalItems,
      totalPages,
    },
  };
}
