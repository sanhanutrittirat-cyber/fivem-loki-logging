import "server-only";
import { z } from "zod";

const Schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  INGEST_API_TOKEN: z.string().min(16),
  INGEST_RPS: z.coerce.number().default(300),
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
  try { return JSON.parse(env.SERVER_SECRETS_JSON); } catch { return {}; }
})();
