import "server-only";
import { env } from "../env";
import type { TxLogEnriched } from "../schema";

const PUSH_URL = `${env.LOKI_URL.replace(/\/$/, "")}/loki/api/v1/push`;
const AUTH =
  env.LOKI_USERNAME && env.LOKI_PASSWORD
    ? "Basic " + Buffer.from(`${env.LOKI_USERNAME}:${env.LOKI_PASSWORD}`).toString("base64")
    : undefined;

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
    if (!s) { s = { stream: JSON.parse(k), values: [] }; streams.set(k, s); }
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
  const res = await fetch(PUSH_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(AUTH ? { authorization: AUTH } : {}),
      ...(env.LOKI_TENANT_ID ? { "X-Scope-OrgID": env.LOKI_TENANT_ID } : {}),
    },
    body: JSON.stringify({ streams: [...streams.values()] }),
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`loki push ${res.status}: ${text.slice(0, 300)}`);
  }
}
