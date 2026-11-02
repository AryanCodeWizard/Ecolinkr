import { afterAll, beforeAll, beforeEach, inject, vi } from "vitest";
import { mailbox } from "./mailbox.js";

// Must happen before the app (and config/env.ts) is imported by any test file.
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: inject("mongoUri"),
  REDIS_URL: inject("redisUrl"),
  JWT_ACCESS_SECRET: "test-access-secret-0123456789",
  USER_SERVICE_URL: "http://user.test",
  INTERNAL_API_KEY: "test-internal-key-0123456789",
  OTP_SECRET: "test-otp-secret-0123456789",
  PASSWORD_RESET_URL: "http://localhost:5173/reset-password",
  BCRYPT_ROUNDS: "4", // fast hashing in tests
  TRUST_PROXY: "1", // lets tests set the client IP via X-Forwarded-For
});

vi.mock("../services/email.service.js", async () => {
  const { mailbox } = await import("./mailbox.js");
  return {
    sendWelcomeEmail: (to: string, name: string) => mailbox.push({ type: "welcome", to, name }),
    sendLoginAlertEmail: (to: string, name: string, ctx: any) =>
      mailbox.push({ type: "loginAlert", to, name, ctx }),
    sendOtpEmail: (to: string, code: string) => mailbox.push({ type: "otp", to, code }),
    sendPasswordResetEmail: (to: string, name: string, link: string) =>
      mailbox.push({ type: "passwordReset", to, name, link }),
    sendPasswordChangedEmail: (to: string, name: string) =>
      mailbox.push({ type: "passwordChanged", to, name }),
  };
});

beforeAll(async () => {
  const mongoose = (await import("mongoose")).default;
  const { connectDb } = await import("../config/db.js");
  const { connectRedis } = await import("../config/redis.js");
  vi.spyOn(console, "log").mockImplementation(() => {});
  await connectDb();
  await connectRedis();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // build indexes
});

beforeEach(async () => {
  const mongoose = (await import("mongoose")).default;
  const { redis } = await import("../config/redis.js");
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
  if (redis.status === "ready") await redis.flushdb();
  mailbox.length = 0;
});

afterAll(async () => {
  const { disconnectDb } = await import("../config/db.js");
  const { redis } = await import("../config/redis.js");
  await disconnectDb();
  redis.disconnect();
});
