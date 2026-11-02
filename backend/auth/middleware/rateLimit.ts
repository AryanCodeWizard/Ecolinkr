import type { Request, RequestHandler } from "express";
import { redis } from "../config/redis.js";
import { AppError } from "../utils/AppError.js";

interface Options {
  /** Short name used in the Redis key, e.g. "login:ip". */
  name: string;
  windowSec: number;
  max: number;
  /** Returns the identity to limit on; return undefined to skip (e.g. no email in body). */
  key: (req: Request) => string | undefined;
}

// Atomically count a hit and start the window on the first one. Returns [count, ttlMs].
const SCRIPT = `
local c = redis.call('INCR', KEYS[1])
if c == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
return {c, redis.call('PTTL', KEYS[1])}
`;

export const byIp = (req: Request) => req.ip;

export const byUser = (req: Request) => req.auth?.sub;

export const byEmail = (req: Request) => {
  const email = req.body?.email;
  return typeof email === "string" && email ? email.trim().toLowerCase() : undefined;
};

export function rateLimit({ name, windowSec, max, key }: Options): RequestHandler {
  return async (req, res, next) => {
    const id = key(req);
    if (!id) return next();

    let count: number;
    let ttlMs: number;
    try {
      [count, ttlMs] = (await redis.eval(
        SCRIPT, 1, `rl:${name}:${id}`, windowSec * 1000,
      )) as [number, number];
    } catch (err) {
      // Fail open: a Redis outage shouldn't take authentication down with it.
      console.error(`Rate limiter unavailable (${name}):`, (err as Error).message);
      return next();
    }

    const retryAfter = Math.max(1, Math.ceil(ttlMs / 1000));
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - count)));
    res.setHeader("RateLimit-Reset", String(retryAfter));

    if (count > max) {
      res.setHeader("Retry-After", String(retryAfter));
      return next(AppError.tooManyRequests(retryAfter));
    }
    next();
  };
}
