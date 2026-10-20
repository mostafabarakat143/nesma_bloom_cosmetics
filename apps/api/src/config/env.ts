import path from "node:path";

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
    /** Bearer JWT lifetime in seconds (default 7 days). */
    JWT_TTL_SECONDS: z.coerce.number().int().positive().default(604_800),
    JWT_ISSUER: z.string().min(1).default("nesma-bloom-api"),
    JWT_AUDIENCE: z.string().min(1).default("nesma-bloom-clients"),
    /** How long a password-reset link stays valid. */
    PASSWORD_RESET_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .max(86_400)
      .default(1_800),
    /** Public site origin used to build reset links. */
    APP_PUBLIC_URL: z.string().url().default("http://localhost:3000"),
    /**
     * Directory for uploaded catalog and profile images.
     * Relative paths are resolved from the API process working directory.
     */
    UPLOAD_DIR: z.string().min(1).default("uploads"),
    /** Origin used in stored image URLs. No path, query, or hash. */
    API_PUBLIC_URL: z
      .string()
      .url()
      .default("http://localhost:4000")
      .refine((value) => {
        const url = new URL(value);
        return url.pathname === "/" && url.search === "" && url.hash === "";
      }, "API_PUBLIC_URL must be an origin with no path, query, or hash"),
    /** Leave blank to skip real email. All five SMTP values are required to send. */
    SMTP_HOST: z.string().default(""),
    SMTP_PORT: z.coerce.number().int().positive().max(65535).default(587),
    SMTP_USER: z.string().default(""),
    SMTP_PASS: z.string().default(""),
    SMTP_FROM: z.string().default(""),
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
  .transform((value) => {
    const docsDefault = value.NODE_ENV === "production" ? false : true;
    const enableApiDocs =
      value.ENABLE_API_DOCS === undefined
        ? docsDefault
        : value.ENABLE_API_DOCS === "true";

    return {
      ...value,
      ENABLE_API_DOCS: enableApiDocs,
      UPLOAD_DIR: path.resolve(value.UPLOAD_DIR),
      API_PUBLIC_URL: value.API_PUBLIC_URL.replace(/\/$/, ""),
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
