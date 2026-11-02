import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { ROLES, UserProfile, type Role } from "../models/UserProfile.js";
import { AppError } from "../utils/AppError.js";

export interface AccessPayload {
  sub: string;
  role: Role;
}

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
    const payload = jwt.verify(header.slice(7), env.JWT_ACCESS_SECRET) as Partial<AccessPayload>;
    if (typeof payload.sub !== "string" || !ROLES.includes(payload.role as Role)) throw new Error();
    req.auth = { sub: payload.sub, role: payload.role as Role };
    next();
  } catch {
    next(AppError.unauthorized("Invalid or expired token"));
  }
};

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.auth) return next(AppError.unauthorized());
    if (!roles.includes(req.auth.role)) return next(AppError.forbidden("Insufficient role"));
    next();
  };

// Deactivated accounts keep a valid JWT until it expires, so check the flag on every /me call.
export const requireActive: RequestHandler = async (req, _res, next) => {
  const profile = await UserProfile.exists({ userId: req.auth!.sub, isActive: false });
  next(profile ? AppError.forbidden("Account is deactivated") : undefined);
};
