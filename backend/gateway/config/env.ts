import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  JWT_ACCESS_SECRET: z.string().min(16),
  AUTH_SERVICE_URL: z.url(),
  USER_SERVICE_URL: z.url(),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(300),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
