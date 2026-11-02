import { Redis } from "ioredis";
import { env } from "./env.js";

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
});

redis.on("error", (err) => console.error("Redis error:", err.message));

export async function connectRedis() {
  await redis.connect();
  console.log("Redis connected");
}

export async function disconnectRedis() {
  await redis.quit();
}
