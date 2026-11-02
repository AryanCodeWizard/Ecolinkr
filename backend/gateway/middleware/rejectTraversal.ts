import type { RequestHandler } from "express";
import { AppError } from "../utils/AppError.js";

// Dot-segments (also percent-encoded) could steer a forwarded path out of its public prefix,
// e.g. /users/%2e%2e/internal/users. Nothing legitimate needs them.
export const rejectTraversal: RequestHandler = (req, _res, next) => {
  const path = req.originalUrl.split("?")[0];
  let decoded: string;
  try {
    decoded = decodeURIComponent(path).replaceAll("\\", "/");
  } catch {
    return next(AppError.badRequest("Malformed URL"));
  }
  if (decoded.split("/").some((seg) => seg === ".." || seg === ".")) {
    return next(AppError.badRequest("Invalid path"));
  }
  next();
};
