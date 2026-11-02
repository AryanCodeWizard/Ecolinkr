import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { Otp } from "../models/Otp.js";
import { syncUser } from "./userSync.service.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { shouldAlertNewDevice } from "./device.service.js";
import { issueSession } from "./refreshToken.service.js";
import {
  sendLoginAlertEmail, sendOtpEmail, sendWelcomeEmail, type RequestContext,
} from "./email.service.js";

const MAX_ATTEMPTS = 5;

const hashCode = (email: string, code: string) =>
  createHmac("sha256", env.OTP_SECRET).update(`${email}:${code}`).digest("hex");

/**
 * Always resolves the same way whether or not the email is known, so the endpoint
 * can't be used to discover accounts. Only collectors can use OTP login.
 */
export async function requestOtp(email: string) {
  const existing = await User.findOne({ email });
  if (existing && (existing.role !== "COLLECTOR" || !existing.isActive)) return;

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await Otp.findOneAndUpdate(
    { email },
    {
      codeHash: hashCode(email, code),
      attempts: 0,
      expiresAt: new Date(Date.now() + env.OTP_TTL_MINUTES * 60_000),
    },
    { upsert: true },
  );
  sendOtpEmail(email, code);
}

export async function verifyOtp(
  input: { email: string; code: string; name?: string },
  ctx: RequestContext,
) {
  const invalid = () => AppError.unauthorized("Invalid or expired code");

  const otp = await Otp.findOneAndUpdate(
    { email: input.email, expiresAt: { $gt: new Date() } },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" },
  );
  if (!otp) throw invalid();
  if (otp.attempts > MAX_ATTEMPTS) {
    await Otp.deleteOne({ _id: otp._id });
    throw invalid();
  }

  const expected = Buffer.from(otp.codeHash);
  const actual = Buffer.from(hashCode(input.email, input.code));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw invalid();

  // Single use: only one concurrent verifier can delete the code.
  const { deletedCount } = await Otp.deleteOne({ _id: otp._id, codeHash: otp.codeHash });
  if (deletedCount !== 1) throw invalid();

  let user = await User.findOne({ email: input.email });
  let isNew = false;
  if (!user) {
    try {
      user = await User.create({
        email: input.email,
        name: input.name ?? input.email.split("@")[0],
        role: "COLLECTOR",
      });
      isNew = true;
      void syncUser(user);
    } catch (err: any) {
      if (err?.code !== 11000) throw err;
      user = await User.findOne({ email: input.email });
    }
  }
  if (!user || user.role !== "COLLECTOR" || !user.isActive) throw invalid();

  const newDevice = await shouldAlertNewDevice(user.id, ctx);
  if (isNew) sendWelcomeEmail(user.email!, user.name);
  else if (newDevice) sendLoginAlertEmail(user.email!, user.name, ctx);

  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    ...(await issueSession(user)),
  };
}
