import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";

// Cheap early rejection. The token is still forwarded and re-verified by the upstream service.
export const verifyJwt: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return next(AppError.unauthorized("Missing bearer token"));
  try {
    jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET);
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired token"));
  }
};
