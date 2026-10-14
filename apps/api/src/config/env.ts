import { z } from "zod";

const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    PORT: z.coerce.number().int().positive().max(65535).default(4000),
    LOG_LEVEL: z
      .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
      .default("info"),
    CORS_ORIGIN: z.string().default(""),
    BODY_SIZE_LIMIT: z.string().default("100kb"),
    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
    DATABASE_URL: z
      .string()
      .min(1, "DATABASE_URL is required")
      .refine(
        (value) =>
          value.startsWith("postgresql://") || value.startsWith("postgres://"),
        "DATABASE_URL must be a PostgreSQL connection string",
      ),
    JWT_ACCESS_SECRET: z
      .string()
      .min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
    JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    REFRESH_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(604_800),
    COOKIE_SECURE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(900_000),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
    /**
     * When true, serves /api/docs and /api/openapi.json.
     * Defaults: enabled outside production; disabled in production unless set.
     */
    ENABLE_API_DOCS: z.enum(["true", "false"]).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && value.COOKIE_SECURE !== true) {
      ctx.addIssue({
        code: "custom",
        path: ["COOKIE_SECURE"],
        message: "COOKIE_SECURE must be true when NODE_ENV=production",
      });
    }
  })
  .transform((value) => {
    const docsDefault = value.NODE_ENV === "production" ? false : true;
    const enableApiDocs =
      value.ENABLE_API_DOCS === undefined
        ? docsDefault
        : value.ENABLE_API_DOCS === "true";

    return {
      ...value,
      ENABLE_API_DOCS: enableApiDocs,
    };
  });

export type Env = z.infer<typeof envSchema>;

export function loadEnv(
  rawEnv: NodeJS.ProcessEnv = process.env,
): Env {
  const result = envSchema.safeParse(rawEnv);

  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }

  return result.data;
}

export function getCorsOrigins(corsOrigin: string): string[] | boolean {
  const trimmed = corsOrigin.trim();

  if (trimmed === "") {
    return false;
  }

  return trimmed
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

export function getTrustedOrigins(env: Env): string[] {
  const origins = getCorsOrigins(env.CORS_ORIGIN);
  if (origins === false || origins === true) {
    return [];
  }
  return origins;
}
