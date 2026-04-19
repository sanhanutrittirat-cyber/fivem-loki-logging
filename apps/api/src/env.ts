import { z } from "zod";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// Auto-load .env from repo root (../../.env) and apps/api/.env if present.
// Uses Node's built-in loader (Node >= 20.12). Silently skips missing files.
for (const p of [resolve(process.cwd(), ".env"), resolve(process.cwd(), "../../.env")]) {
  if (existsSync(p)) {
    try {
      // @ts-expect-error: loadEnvFile is available on Node >= 20.12
      process.loadEnvFile(p);
    } catch { /* ignore */ }
  }
}

const Schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(8080),

  INGEST_API_TOKEN: z.string().min(16),
  INGEST_RPS: z.coerce.number().default(200),
  SERVER_SECRETS_JSON: z.string().default("{}"),

  LOKI_URL: z.string().url(),
  LOKI_TENANT_ID: z.string().optional(),
  LOKI_USERNAME: z.string().optional(),
  LOKI_PASSWORD: z.string().optional(),

  CLICKHOUSE_URL: z.string().url(),
  CLICKHOUSE_DB: z.string().default("logwatch"),
  CLICKHOUSE_USER: z.string().default("default"),
  CLICKHOUSE_PASSWORD: z.string().default(""),

  REDIS_URL: z.string().url(),
});

export const env = Schema.parse(process.env);

export const SERVER_SECRETS: Record<string, string> = (() => {
  try {
    return JSON.parse(env.SERVER_SECRETS_JSON);
  } catch {
    return {};
  }
})();
