import type { FastifyPluginAsync } from "fastify";
import { ch } from "../sinks/clickhouse.js";

interface LogQuery {
  identifier?: string;
  name?: string;
  resource?: string;
  type?: "add" | "remove";
  amount_gt?: string;
  amount_lt?: string;
  amount_eq?: string;
  from?: string; // ISO
  to?: string;   // ISO
  search?: string;
  server_id?: string;
  limit?: string;
  offset?: string;
}

export const logsRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: LogQuery }>("/api/logs", async (req) => {
    const q = req.query;
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
      query: `
        SELECT ts, identifier, name, amount, resource, type, server_id, char_id, reason
        FROM tx_logs
        WHERE ${where.join(" AND ")}
        ORDER BY ts DESC
        LIMIT ${limit} OFFSET ${offset}`,
      query_params: params,
      format: "JSONEachRow",
    });
    const rows = await rs.json<Record<string, unknown>>();
    return { rows, limit, offset };
  });

  app.get<{ Querystring: { field: "name" | "resource" | "identifier"; q?: string } }>(
    "/api/autocomplete",
    async (req, reply) => {
      const { field, q } = req.query;
      if (!["name", "resource", "identifier"].includes(field)) {
        return reply.code(400).send({ error: "bad field" });
      }
      const rs = await ch.query({
        query: `SELECT ${field} AS v, count() AS c FROM tx_logs
                WHERE ts > now() - INTERVAL 7 DAY
                  AND ${field} ILIKE {s:String}
                GROUP BY ${field} ORDER BY c DESC LIMIT 20`,
        query_params: { s: `%${q ?? ""}%` },
        format: "JSONEachRow",
      });
      return { suggestions: await rs.json() };
    },
  );
};
