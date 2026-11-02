import type { RequestHandler } from "express";
import { verifyAccessToken, type AccessPayload } from "../services/token.service.js";
import { AppError } from "../utils/AppError.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessPayload;
    }
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(AppError.unauthorized("Missing bearer token"));
  try {
    req.auth = verifyAccessToken(header.slice(7));
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired token"));
  }
};
