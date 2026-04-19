import Fastify from "fastify";
import rawBody from "fastify-raw-body";
import cors from "@fastify/cors";
import { env } from "./env.js";
import redisPlugin from "./plugins/redis.js";
import { ingestRoute } from "./routes/ingest.js";
import { logsRoute } from "./routes/logs.js";
import { statsRoute } from "./routes/stats.js";
import { streamRoute } from "./routes/stream.js";
import { metrics, startFlusher, flush } from "./buffer.js";

const app = Fastify({
  logger: { level: env.NODE_ENV === "production" ? "info" : "debug" },
  bodyLimit: 2 * 1024 * 1024,
  trustProxy: true,
});

await app.register(cors, { origin: true, credentials: true });
await app.register(rawBody, {
  field: "rawBody",
  global: false,
  encoding: false,
  runFirst: true,
});
await app.register(redisPlugin);

app.get("/healthz", async () => ({ ok: true, ...metrics, queued: metrics.queued, dropped: metrics.dropped }));

app.get("/metrics", async (_req, reply) => {
  reply.type("text/plain");
  return [
    `# HELP logwatch_ingested_total Logs accepted by /ingest`,
    `# TYPE logwatch_ingested_total counter`,
    `logwatch_ingested_total ${metrics.ingested}`,
    `# HELP logwatch_flushed_total Logs flushed to sinks`,
    `# TYPE logwatch_flushed_total counter`,
    `logwatch_flushed_total ${metrics.flushed}`,
    `# HELP logwatch_loki_errors_total Loki push errors`,
    `# TYPE logwatch_loki_errors_total counter`,
    `logwatch_loki_errors_total ${metrics.loki_errors}`,
    `# HELP logwatch_ch_errors_total ClickHouse insert errors`,
    `# TYPE logwatch_ch_errors_total counter`,
    `logwatch_ch_errors_total ${metrics.ch_errors}`,
    `# HELP logwatch_queued Current in-memory queue size`,
    `# TYPE logwatch_queued gauge`,
    `logwatch_queued ${metrics.queued}`,
    `# HELP logwatch_dropped_total Logs dropped due to queue overflow`,
    `# TYPE logwatch_dropped_total counter`,
    `logwatch_dropped_total ${metrics.dropped}`,
    "",
  ].join("\n");
});

await app.register(ingestRoute);
await app.register(logsRoute);
await app.register(statsRoute);
await app.register(streamRoute);

startFlusher();

const shutdown = async (sig: string) => {
  app.log.info({ sig }, "shutting down, flushing buffer");
  try { await flush(); } catch (e) { app.log.error({ e }, "final flush failed"); }
  await app.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
