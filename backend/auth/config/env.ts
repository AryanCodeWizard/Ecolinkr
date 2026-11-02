import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  MONGO_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  REDIS_URL: z.string().min(1),
  USER_SERVICE_URL: z.url(),
  INTERNAL_API_KEY: z.string().min(16),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  OTP_SECRET: z.string().min(16),
  OTP_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  PASSWORD_RESET_URL: z.url().default("http://localhost:5173/reset-password"),
  PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default("EcoLinkr <no-reply@ecolinkr.example>"),
}).refine((e) => e.NODE_ENV !== "production" || !!e.SMTP_HOST, {
  message: "SMTP_HOST is required in production",
  path: ["SMTP_HOST"],
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
