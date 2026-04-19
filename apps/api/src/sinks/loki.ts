import { request } from "undici";
import { env } from "../env.js";
import type { TxLogEnriched } from "../schema.js";

const PUSH_URL = `${env.LOKI_URL.replace(/\/$/, "")}/loki/api/v1/push`;
const AUTH =
  env.LOKI_USERNAME && env.LOKI_PASSWORD
    ? "Basic " + Buffer.from(`${env.LOKI_USERNAME}:${env.LOKI_PASSWORD}`).toString("base64")
    : undefined;

/**
 * Build a label set. KEEP CARDINALITY LOW.
 * Labels: job, env, server_id, type, resource (assumed bounded).
 * NEVER label: identifier, name, amount, reason, char_id.
 */
function labelKey(l: TxLogEnriched): string {
  return JSON.stringify({
    job: "fivem_logs",
    env: env.NODE_ENV,
    server_id: l.server_id,
    type: l.type,
    resource: l.resource,
  });
}

export async function pushLoki(batch: TxLogEnriched[]): Promise<void> {
  if (!batch.length) return;

  const streams = new Map<string, { stream: Record<string, string>; values: [string, string][] }>();
  for (const l of batch) {
    const k = labelKey(l);
    let s = streams.get(k);
    if (!s) {
      s = { stream: JSON.parse(k), values: [] };
      streams.set(k, s);
    }
    // Loki value: [ "<nanoseconds timestamp>", "<line>" ]
    const ns = (BigInt(l.ts) * 1_000_000n).toString();
    s.values.push([
      ns,
      JSON.stringify({
        identifier: l.identifier,
        name: l.name,
        amount: l.amount,
        char_id: l.char_id ?? "",
        reason: l.reason ?? "",
      }),
    ]);
  }

  const body = JSON.stringify({ streams: [...streams.values()] });
  const res = await request(PUSH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(AUTH ? { authorization: AUTH } : {}),
      ...(env.LOKI_TENANT_ID ? { "X-Scope-OrgID": env.LOKI_TENANT_ID } : {}),
    },
    body,
  });

  if (res.statusCode >= 300) {
    const text = await res.body.text();
    throw new Error(`loki push failed ${res.statusCode}: ${text.slice(0, 300)}`);
  } else {
    res.body.dump();
  }
}
