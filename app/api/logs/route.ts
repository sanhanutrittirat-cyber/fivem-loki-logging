export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse, type NextRequest } from "next/server";
import { ch } from "@/lib/server/sinks/clickhouse";

export async function GET(req: NextRequest) {
  const q = Object.fromEntries(req.nextUrl.searchParams);
  const where: string[] = ["1=1"];
  const params: Record<string, unknown> = {};

  if (q.identifier) { where.push("identifier = {identifier:String}"); params.identifier = q.identifier; }
  if (q.name)       { where.push("name = {name:String}");             params.name = q.name; }
  if (q.resource)   { where.push("resource = {resource:String}");     params.resource = q.resource; }
  if (q.server_id)  { where.push("server_id = {server_id:String}");   params.server_id = q.server_id; }
  if (q.type)       { where.push("type = {type:String}");             params.type = q.type; }
  if (q.amount_gt)  { where.push("amount > {agt:Int64}");             params.agt = Number(q.amount_gt); }
  if (q.amount_lt)  { where.push("amount < {alt:Int64}");             params.alt = Number(q.amount_lt); }
  if (q.amount_eq)  { where.push("amount = {aeq:Int64}");             params.aeq = Number(q.amount_eq); }
  if (q.from)       { where.push("ts >= {from:DateTime64(3)}");       params.from = q.from; }
  if (q.to)         { where.push("ts <  {to:DateTime64(3)}");         params.to = q.to; }
  if (q.search) {
    where.push("(name ILIKE {s:String} OR reason ILIKE {s:String} OR identifier ILIKE {s:String})");
    params.s = `%${q.search}%`;
  }

  const limit = Math.min(Number(q.limit ?? 100), 500);
  const offset = Math.max(0, Number(q.offset ?? 0));

  const rs = await ch.query({
    query: `SELECT ts, identifier, name, amount, resource, type, server_id, char_id, reason
            FROM tx_logs WHERE ${where.join(" AND ")}
            ORDER BY ts DESC LIMIT ${limit} OFFSET ${offset}`,
    query_params: params,
    format: "JSONEachRow",
  });
  const rows = await rs.json();
  return NextResponse.json({ rows, limit, offset });
}
