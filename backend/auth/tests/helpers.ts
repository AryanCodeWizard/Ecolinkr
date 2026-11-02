import request from "supertest";
import jwt from "jsonwebtoken";
import { app } from "../app.js";
import { lastMail } from "./mailbox.js";

export const api = () => request(app);

export const PASSWORD = "Password123!";

export const registerRecycler = (email = "rec@example.com", password = PASSWORD) =>
  api().post("/auth/register").send({ name: "Rec Co", email, password });

export const login = (email = "rec@example.com", password = PASSWORD) =>
  api().post("/auth/login").send({ email, password });

/** Full OTP login for a collector (creates the account on first use). */
export async function collectorLogin(email = "col@example.com", name?: string) {
  await api().post("/auth/otp/request").send({ email });
  const code = lastMail("otp", email)!.code!;
  return api().post("/auth/otp/verify").send({ email, code, name });
}

export const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

export const tokenFromResetLink = (link: string) => new URL(link).searchParams.get("token")!;

export const signToken = (
  payload: object,
  opts: { secret?: string; expiresIn?: number } = {},
) =>
  jwt.sign(payload, opts.secret ?? process.env.JWT_ACCESS_SECRET!, {
    expiresIn: opts.expiresIn ?? 900,
  });

export const INTERNAL = { "X-Internal-Key": "test-internal-key-0123456789" };
