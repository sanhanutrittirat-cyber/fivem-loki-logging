import "server-only";
import IORedis, { type Redis } from "ioredis";
import { env } from "./env";

declare global { var __redis: Redis | undefined; }

export const redis: Redis =
  global.__redis ?? (global.__redis = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: 3 }));
