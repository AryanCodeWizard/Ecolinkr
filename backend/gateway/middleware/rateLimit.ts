import { rateLimit } from "express-rate-limit";
import { env } from "../config/env.js";

// In-memory, per gateway instance. Move the store to Redis when running more than one replica.
export const globalRateLimit = rateLimit({
  windowMs: 60_000,
  limit: env.RATE_LIMIT_PER_MINUTE,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler: (_req, res) => {
    const retryAfterSec = Number(res.getHeader("Retry-After")) || 60;
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many requests, please try again later",
        details: { retryAfterSec: retryAfterSec },
      },
    });
  },
});
