import IORedis, { type Redis } from "ioredis";
import type { FastifyInstance } from "fastify";
import { env } from "../env.js";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export default async function redisPlugin(app: FastifyInstance): Promise<void> {
  const redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: 3 });
  app.decorate("redis", redis);
  app.addHook("onClose", async () => {
    await redis.quit();
  });
}
