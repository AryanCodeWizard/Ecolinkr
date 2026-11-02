export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, "BAD_REQUEST", message, details);
  }
  static unauthorized(message = "Unauthorized") {
    return new AppError(401, "UNAUTHORIZED", message);
  }
  static forbidden(message = "Forbidden") {
    return new AppError(403, "FORBIDDEN", message);
  }
  static notFound(message = "Not found") {
    return new AppError(404, "NOT_FOUND", message);
  }
  static tooManyRequests(retryAfterSec: number) {
    return new AppError(429, "RATE_LIMITED", "Too many requests, please try again later", {
      retryAfterSec,
    });
  }
  static conflict(message: string) {
    return new AppError(409, "CONFLICT", message);
  }
}
