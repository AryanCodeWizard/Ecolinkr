import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

// Always generated here: a client-supplied id would let callers forge log correlation.
export const requestId: RequestHandler = (req, res, next) => {
  req.id = randomUUID();
  res.setHeader("X-Request-Id", req.id);
  next();
};
