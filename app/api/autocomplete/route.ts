export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { ch } from "@/lib/server/sinks/clickhouse";

const ALLOWED = new Set(["name", "resource", "identifier"]);

export async function GET(req: NextRequest) {
  const field = req.nextUrl.searchParams.get("field") ?? "";
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!ALLOWED.has(field)) return NextResponse.json({ error: "bad field" }, { status: 400 });

  const rs = await ch.query({
    query: `SELECT ${field} AS v, count() AS c FROM tx_logs
            WHERE ts > now() - INTERVAL 7 DAY AND ${field} ILIKE {s:String}
            GROUP BY ${field} ORDER BY c DESC LIMIT 20`,
    query_params: { s: `%${q}%` },
    format: "JSONEachRow",
  });
  return NextResponse.json({ suggestions: await rs.json() });
}
