export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { ch } from "@/lib/server/sinks/clickhouse";
import { redis } from "@/lib/server/redis";

const RANGE_TO_HOURS: Record<string, number> = {
  "15m": 0.25, "1h": 1, "6h": 6, "24h": 24, "7d": 24 * 7,
};

export async function GET(req: NextRequest) {
  const rangeIn = req.nextUrl.searchParams.get("range") ?? "1h";
  const range = RANGE_TO_HOURS[rangeIn] ? rangeIn : "1h";
  const hours = RANGE_TO_HOURS[range];
  const serverId = req.nextUrl.searchParams.get("server_id") ?? undefined;

  const cacheKey = `stats:overview:${range}:${serverId ?? "_all"}`;
  const cached = await redis.get(cacheKey);
  if (cached) return new NextResponse(cached, { headers: { "content-type": "application/json" } });

  const serverFilter = serverId ? `AND server_id = {sid:String}` : "";
  const params: Record<string, unknown> = { sid: serverId ?? "" };
  const since = `now() - INTERVAL ${hours} HOUR`;

  const [ratio, topItems, topResources, topPlayers, series] = await Promise.all([
    ch.query({ query: `SELECT type, count() AS c, sum(amount) AS s FROM tx_logs WHERE ts > ${since} ${serverFilter} GROUP BY type`, query_params: params, format: "JSONEachRow" }).then(r => r.json()),
    ch.query({ query: `SELECT name, type, sum(amount) AS s, count() AS n FROM tx_logs WHERE ts > ${since} ${serverFilter} GROUP BY name,type ORDER BY n DESC LIMIT 20`, query_params: params, format: "JSONEachRow" }).then(r => r.json()),
    ch.query({ query: `SELECT resource, count() AS c FROM tx_logs WHERE ts > ${since} ${serverFilter} GROUP BY resource ORDER BY c DESC LIMIT 20`, query_params: params, format: "JSONEachRow" }).then(r => r.json()),
    ch.query({ query: `SELECT identifier, sum(abs(amount)) AS v, count() AS n FROM tx_logs WHERE ts > ${since} ${serverFilter} GROUP BY identifier ORDER BY v DESC LIMIT 20`, query_params: params, format: "JSONEachRow" }).then(r => r.json()),
    ch.query({ query: `SELECT toStartOfInterval(ts, INTERVAL 1 MINUTE) AS bucket, type, count() AS c FROM tx_logs WHERE ts > ${since} ${serverFilter} GROUP BY bucket, type ORDER BY bucket`, query_params: params, format: "JSONEachRow" }).then(r => r.json()),
  ]);

  const out = JSON.stringify({ range, ratio, topItems, topResources, topPlayers, series });
  await redis.setex(cacheKey, 15, out);
  return new NextResponse(out, { headers: { "content-type": "application/json" } });
}
