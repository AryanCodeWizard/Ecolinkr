import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

// Service-to-service calls only; the key is never sent by browsers or the public gateway routes.
export const requireInternalKey: RequestHandler = (req, _res, next) => {
  const given = Buffer.from(String(req.headers["x-internal-key"] ?? ""));
  const expected = Buffer.from(env.INTERNAL_API_KEY);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return next(AppError.unauthorized("Invalid internal key"));
  }
  next();
};
