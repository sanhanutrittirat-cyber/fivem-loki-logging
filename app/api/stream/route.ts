export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import type { NextRequest } from "next/server";
import { ch } from "@/lib/server/sinks/clickhouse";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const where: string[] = ["ts > {ts:DateTime64(3)}"];
  const params: Record<string, unknown> = {};
  const map: Record<string, string> = {
    identifier: "identifier", name: "name", resource: "resource",
    server_id: "server_id", type: "type",
  };
  for (const [k, col] of Object.entries(map)) {
    const v = sp.get(k);
    if (v) { where.push(`${col} = {${k}:String}`); params[k] = v; }
  }
  const search = sp.get("search");
  if (search) {
    where.push("(name ILIKE {s:String} OR reason ILIKE {s:String} OR identifier ILIKE {s:String})");
    params.s = `%${search}%`;
  }

  let lastTs = new Date(Date.now() - 5_000).toISOString();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(enc.encode(`event: hello\ndata: {"now":${Date.now()}}\n\n`));

      const heartbeat = setInterval(() => {
        try { controller.enqueue(enc.encode(`: ping\n\n`)); } catch { /* closed */ }
      }, 15_000);

      const tick = setInterval(async () => {
        try {
          const rs = await ch.query({
            query: `SELECT ts, identifier, name, amount, resource, type, server_id
                    FROM tx_logs WHERE ${where.join(" AND ")}
                    ORDER BY ts ASC LIMIT 500`,
            query_params: { ...params, ts: lastTs },
            format: "JSONEachRow",
          });
          const rows = await rs.json<Array<{ ts: string }>>();
          if (rows.length) {
            lastTs = rows[rows.length - 1].ts;
            controller.enqueue(enc.encode(`event: logs\ndata: ${JSON.stringify(rows)}\n\n`));
          }
        } catch (err) {
          controller.enqueue(enc.encode(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`));
        }
      }, 1000);

      const abort = () => {
        clearInterval(tick); clearInterval(heartbeat);
        try { controller.close(); } catch { /* */ }
      };
      req.signal.addEventListener("abort", abort);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      "connection": "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
