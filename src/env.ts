import "server-only";

import { z } from "zod";

const trimmedUrl = z
  .url()
  .transform((value) => value.replace(/\/+$/, ""));

const envSchema = z.object({
  CONFIO_API_URL: trimmedUrl,
  CONFIO_ACCESS_TOKEN: z.string().min(1),
  // Accept both "<id>" and "stores/<id>" and keep only the id.
  CONFIO_STORE_ID: z
    .string()
    .min(1)
    .transform((value) => value.replace(/^stores\//, "")),
  CONFIO_WEBHOOK_SECRET: z.string().min(16),
  SUPABASE_URL: trimmedUrl,
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8),
  SESSION_SECRET: z.string().min(32),
  APP_URL: trimmedUrl,
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/**
 * Server-only, validated environment. Validation is lazy so `next build` does not
 * require real secrets; set SKIP_ENV_VALIDATION=1 to bypass it entirely (CI builds).
 */
export function getEnv(): Env {
  if (cached) return cached;

  if (process.env.SKIP_ENV_VALIDATION === "1") {
    cached = process.env as unknown as Env;
    return cached;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${fields}`);
  }
  cached = parsed.data;
  return cached;
}
