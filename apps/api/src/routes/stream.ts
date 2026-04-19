import type { FastifyPluginAsync } from "fastify";
import { ch } from "../sinks/clickhouse.js";

/**
 * Server-Sent Events live tail.
 * Polls ClickHouse every 1s for new rows since lastTs.
 * Filters: identifier, name, resource, type, server_id, search.
 */
export const streamRoute: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: {
      identifier?: string;
      name?: string;
      resource?: string;
      type?: "add" | "remove";
      server_id?: string;
      search?: string;
    };
  }>("/api/stream", async (req, reply) => {
    reply.raw.setHeader("content-type", "text/event-stream");
    reply.raw.setHeader("cache-control", "no-cache, no-transform");
    reply.raw.setHeader("connection", "keep-alive");
    reply.raw.setHeader("x-accel-buffering", "no");
    reply.raw.flushHeaders?.();

    const q = req.query;
    const where: string[] = ["ts > {ts:DateTime64(3)}"];
    const params: Record<string, unknown> = {};
    if (q.identifier) { where.push("identifier = {identifier:String}"); params.identifier = q.identifier; }
    if (q.name)       { where.push("name = {name:String}");             params.name = q.name; }
    if (q.resource)   { where.push("resource = {resource:String}");     params.resource = q.resource; }
    if (q.server_id)  { where.push("server_id = {server_id:String}");   params.server_id = q.server_id; }
    if (q.type)       { where.push("type = {type:String}");             params.type = q.type; }
    if (q.search) {
      where.push("(name ILIKE {s:String} OR reason ILIKE {s:String} OR identifier ILIKE {s:String})");
      params.s = `%${q.search}%`;
    }

    let lastTs = new Date(Date.now() - 5_000).toISOString();

    const send = (event: string, data: unknown) => {
      reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    };
    send("hello", { now: Date.now() });

    const heartbeat = setInterval(() => reply.raw.write(`: ping\n\n`), 15_000);

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
          send("logs", rows);
        }
      } catch (err) {
        app.log.error({ err }, "stream tick failed");
      }
    }, 1000);

    req.raw.on("close", () => {
      clearInterval(tick);
      clearInterval(heartbeat);
      reply.raw.end();
    });
  });
};
