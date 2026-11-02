import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../app.js";

export const api = () => request(app);

export const newId = () => Array.from({ length: 24 }, () => Math.floor(Math.random() * 16).toString(16)).join("");

export const signToken = (
  payload: object,
  opts: { secret?: string; expiresIn?: number } = {},
) =>
  jwt.sign(payload, opts.secret ?? process.env.JWT_ACCESS_SECRET!, {
    expiresIn: opts.expiresIn ?? 900,
  });

/** Authorization header for a user as the auth service would issue it. */
export const as = (role: "COLLECTOR" | "RECYCLER" | "ADMIN", sub = newId()) => ({
  sub,
  headers: { Authorization: `Bearer ${signToken({ sub, role })}` },
});

export const INTERNAL = { "X-Internal-Key": "test-internal-key-0123456789" };
