import { z } from "zod";

export const createContactBodySchema = z
  .object({
    name: z
      .string({ error: () => "Name is required." })
      .trim()
      .min(1, "Name is required.")
      .max(120),
    phone: z
      .string({ error: () => "Phone is required." })
      .trim()
      .min(3, "Phone is required.")
      .max(30),
    email: z
      .string({ error: () => "Email is required." })
      .trim()
      .email("Email is invalid.")
      .max(255)
      .transform((value) => value.toLowerCase()),
    message: z
      .string({ error: () => "Message is required." })
      .trim()
      .min(1, "Message is required.")
      .max(5000),
  })
  .strict();

export const listContactQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type CreateContactBody = z.infer<typeof createContactBodySchema>;
export type ListContactQuery = z.infer<typeof listContactQuerySchema>;
