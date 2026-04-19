export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/server/env";
import { TxBatch } from "@/lib/server/schema";
import { verifyHmac } from "@/lib/server/auth/hmac";
import { enqueue, ensureFlusher } from "@/lib/server/buffer";
import { redis } from "@/lib/server/redis";

const RL_SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n
`;

ensureFlusher();

export async function POST(req: NextRequest) {
  // 1. shared token
  if (req.headers.get("x-ingest-token") !== env.INGEST_API_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. per-server HMAC over raw body
  const serverId = req.headers.get("x-server-id") ?? "";
  const sig = req.headers.get("x-signature") ?? "";
  const raw = Buffer.from(await req.arrayBuffer());
  if (!serverId || !verifyHmac(serverId, raw, sig)) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  // 3. rate limit (per-server RPS)
  const n = (await redis.eval(RL_SCRIPT, 1, `rl:${serverId}`, "1")) as number;
  if (n > env.INGEST_RPS) {
    return NextResponse.json({ error: "rate limited" }, { status: 429 });
  }

  // 4. validate
  let body: unknown;
  try { body = JSON.parse(raw.toString("utf8")); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }
  const parsed = TxBatch.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation", issues: parsed.error.flatten() }, { status: 400 });
  }

  // 5. enrich + enqueue
  const now = Date.now();
  for (const l of parsed.data.logs) {
    const ts = l.ts ?? now;
    const clamped = Math.abs(ts - now) > 5 * 60_000 ? now : ts;
    enqueue({
      ...l,
      ts: clamped,
      server_id: l.server_id ?? serverId,
      amount: Math.trunc(l.amount),
    });
  }
  return NextResponse.json({ accepted: parsed.data.logs.length }, { status: 202 });
}
