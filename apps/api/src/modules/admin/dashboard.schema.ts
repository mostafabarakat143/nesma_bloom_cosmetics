import { z } from "zod";

const rangeInstantSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid date")
  .transform((value) => new Date(value));

export const dashboardQuerySchema = z
  .object({
    from: rangeInstantSchema.optional(),
    to: rangeInstantSchema.optional(),
    bucket: z.enum(["month", "day"]).default("month"),
  })
  .strict()
  .refine(
    (value) => !value.from || !value.to || value.from.getTime() <= value.to.getTime(),
    "from must be earlier than or equal to to",
  );

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;
