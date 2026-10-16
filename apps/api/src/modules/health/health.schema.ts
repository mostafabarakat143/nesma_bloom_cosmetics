import { z } from "zod";

/**
 * Demo schema used to exercise the shared validate middleware.
 * Not a business endpoint — removed or replaced when real modules land.
 */
export const healthEchoBodySchema = z
  .object({
    message: z
      .string({ error: () => "Message is required." })
      .trim()
      .min(1, "Message is required.")
      .max(200),
  })
  .strict();

export type HealthEchoBody = z.infer<typeof healthEchoBodySchema>;
