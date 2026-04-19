import type { FastifyPluginAsync } from "fastify";
import { ch } from "../sinks/clickhouse.js";

const RANGE_TO_HOURS: Record<string, number> = {
  "15m": 0.25,
  "1h": 1,
  "6h": 6,
  "24h": 24,
  "7d": 24 * 7,
};

export const statsRoute: FastifyPluginAsync = async (app) => {
  app.get<{ Querystring: { range?: string; server_id?: string } }>(
    "/api/stats/overview",
    async (req) => {
      const range = (req.query.range && RANGE_TO_HOURS[req.query.range]) ? req.query.range : "1h";
      const hours = RANGE_TO_HOURS[range];
      const serverFilter = req.query.server_id ? `AND server_id = {sid:String}` : "";
      const params: Record<string, unknown> = { sid: req.query.server_id ?? "" };

      const cacheKey = `stats:overview:${range}:${req.query.server_id ?? "_all"}`;
      const cached = await app.redis.get(cacheKey);
      if (cached) return JSON.parse(cached);

      const since = `now() - INTERVAL ${hours} HOUR`;

      const [ratio, topItems, topResources, topPlayers, series] = await Promise.all([
        ch.query({
          query: `SELECT type, count() AS c, sum(amount) AS s
                  FROM tx_logs WHERE ts > ${since} ${serverFilter} GROUP BY type`,
          query_params: params, format: "JSONEachRow",
        }).then((r) => r.json()),

        ch.query({
          query: `SELECT name, type, sum(amount) AS s, count() AS n
                  FROM tx_logs WHERE ts > ${since} ${serverFilter}
                  GROUP BY name, type ORDER BY n DESC LIMIT 20`,
          query_params: params, format: "JSONEachRow",
        }).then((r) => r.json()),

        ch.query({
          query: `SELECT resource, count() AS c
                  FROM tx_logs WHERE ts > ${since} ${serverFilter}
                  GROUP BY resource ORDER BY c DESC LIMIT 20`,
          query_params: params, format: "JSONEachRow",
        }).then((r) => r.json()),

        ch.query({
          query: `SELECT identifier, sum(abs(amount)) AS v, count() AS n
                  FROM tx_logs WHERE ts > ${since} ${serverFilter}
                  GROUP BY identifier ORDER BY v DESC LIMIT 20`,
          query_params: params, format: "JSONEachRow",
        }).then((r) => r.json()),

        ch.query({
          query: `SELECT toStartOfInterval(ts, INTERVAL 1 MINUTE) AS bucket,
                         type, count() AS c
                  FROM tx_logs WHERE ts > ${since} ${serverFilter}
                  GROUP BY bucket, type ORDER BY bucket`,
          query_params: params, format: "JSONEachRow",
        }).then((r) => r.json()),
      ]);

      const out = { range, ratio, topItems, topResources, topPlayers, series };
      await app.redis.setex(cacheKey, 15, JSON.stringify(out));
      return out;
    },
  );
};
