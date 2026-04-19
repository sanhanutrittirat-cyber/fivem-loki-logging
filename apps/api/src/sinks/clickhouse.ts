import { createClient } from "@clickhouse/client";
import { env } from "../env.js";
import type { TxLogEnriched } from "../schema.js";

export const ch = createClient({
  url: env.CLICKHOUSE_URL,
  username: env.CLICKHOUSE_USER,
  password: env.CLICKHOUSE_PASSWORD,
  database: env.CLICKHOUSE_DB,
  clickhouse_settings: {
    async_insert: 1,
    wait_for_async_insert: 0,
  },
});

export async function insertClickhouse(batch: TxLogEnriched[]): Promise<void> {
  if (!batch.length) return;
  await ch.insert({
    table: "tx_logs",
    format: "JSONEachRow",
    values: batch.map((l) => ({
      ts: new Date(l.ts).toISOString(),
      identifier: l.identifier,
      name: l.name,
      amount: Math.trunc(l.amount),
      resource: l.resource,
      type: l.type,
      server_id: l.server_id,
      char_id: l.char_id ?? "",
      reason: l.reason ?? "",
    })),
  });
}
