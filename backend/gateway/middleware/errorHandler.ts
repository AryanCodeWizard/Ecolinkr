import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";

export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(AppError.notFound("Route not found"));
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    // fieldErrors: per-field messages; formErrors: object-level ones such as unrecognised keys.
    const { fieldErrors, formErrors } = err.flatten();
    err = AppError.badRequest("Validation failed", { ...fieldErrors, ...(formErrors.length && { _form: formErrors }) });
  }

  // Malformed JSON body etc.
  if (err?.type === "entity.parse.failed") err = AppError.badRequest("Invalid JSON body");
  if (err?.type === "entity.too.large") {
    err = new AppError(413, "PAYLOAD_TOO_LARGE", "Request body too large");
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }

  console.error("Unhandled error:", err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Internal server error" },
  });
};
