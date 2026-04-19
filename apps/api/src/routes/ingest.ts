import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { TxBatch } from "../schema.js";
import { verifyHmac } from "../auth/hmac.js";
import { enqueue } from "../buffer.js";
import { env } from "../env.js";

const RL_SCRIPT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n
`;

export const ingestRoute: FastifyPluginAsync = async (app) => {
  app.post(
    "/ingest",
    { config: { rawBody: true } },
    async (req: FastifyRequest, reply) => {
      // 1. shared token
      if (req.headers["x-ingest-token"] !== env.INGEST_API_TOKEN) {
        return reply.code(401).send({ error: "unauthorized" });
      }

      // 2. per-server HMAC
      const serverId = String(req.headers["x-server-id"] ?? "");
      const sig = String(req.headers["x-signature"] ?? "");
      const raw = (req as unknown as { rawBody: Buffer | string }).rawBody;
      if (!serverId || !verifyHmac(serverId, raw, sig)) {
        return reply.code(401).send({ error: "bad signature" });
      }

      // 3. rate limit (per server, RPS)
      const n = (await app.redis.eval(RL_SCRIPT, 1, `rl:${serverId}`, "1")) as number;
      if (n > env.INGEST_RPS) {
        return reply.code(429).send({ error: "rate limited" });
      }

      // 4. validate
      const parsed = TxBatch.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: "validation", issues: parsed.error.flatten() });
      }

      // 5. enrich + enqueue
      const now = Date.now();
      for (const l of parsed.data.logs) {
        const ts = l.ts ?? now;
        // clamp ts to ±5 min of server clock to prevent spoof
        const clamped = Math.abs(ts - now) > 5 * 60_000 ? now : ts;
        enqueue({
          ...l,
          ts: clamped,
          server_id: l.server_id ?? serverId,
          amount: Math.trunc(l.amount),
        });
      }

      return reply.code(202).send({ accepted: parsed.data.logs.length });
    },
  );
};
