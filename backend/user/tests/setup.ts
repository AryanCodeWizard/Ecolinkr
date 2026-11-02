import { afterAll, beforeAll, beforeEach, inject, vi } from "vitest";

// Must happen before the app (and config/env.ts) is imported by any test file.
Object.assign(process.env, {
  NODE_ENV: "test",
  MONGO_URI: inject("mongoUri"),
  AUTH_SERVICE_URL: "http://auth.test",
  INTERNAL_API_KEY: "test-internal-key-0123456789",
  JWT_ACCESS_SECRET: "test-access-secret-0123456789",
});

beforeAll(async () => {
  const mongoose = (await import("mongoose")).default;
  const { connectDb } = await import("../config/db.js");
  vi.spyOn(console, "log").mockImplementation(() => {});
  await connectDb();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init())); // build indexes
});

beforeEach(async () => {
  const mongoose = (await import("mongoose")).default;
  await Promise.all(Object.values(mongoose.models).map((m) => m.deleteMany({})));
});

afterAll(async () => {
  const { disconnectDb } = await import("../config/db.js");
  await disconnectDb();
});
