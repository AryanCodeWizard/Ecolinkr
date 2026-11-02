import bcrypt from "bcrypt";
import { createHash, randomBytes } from "node:crypto";
import { env } from "../config/env.js";
import { PasswordReset } from "../models/PasswordReset.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { sendPasswordChangedEmail, sendPasswordResetEmail } from "./email.service.js";
import { issueSession, revokeAllForUser } from "./refreshToken.service.js";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

/** Always resolves identically so it can't be used to discover which emails are registered. */
export async function forgotPassword(email: string) {
  const user = await User.findOne({ email }).select("+passwordHash");
  // Accounts without a password (OTP-only collectors) have nothing to reset.
  if (!user || !user.isActive || !user.passwordHash) return;

  const token = randomBytes(32).toString("base64url");
  await PasswordReset.deleteMany({ userId: user.id }); // only the latest link works
  await PasswordReset.create({
    userId: user.id,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + env.PASSWORD_RESET_TTL_MINUTES * 60_000),
  });

  const url = new URL(env.PASSWORD_RESET_URL);
  url.searchParams.set("token", token);
  sendPasswordResetEmail(email, user.name, url.toString());
}

export async function resetPassword(token: string, newPassword: string) {
  // Atomic claim: the token is single-use even under concurrent requests.
  const reset = await PasswordReset.findOneAndDelete({
    tokenHash: hash(token),
    expiresAt: { $gt: new Date() },
  });
  if (!reset) throw AppError.badRequest("Reset link is invalid or has expired");

  const user = await User.findById(reset.userId);
  if (!user || !user.isActive) throw AppError.badRequest("Reset link is invalid or has expired");

  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await user.save();
  await PasswordReset.deleteMany({ userId: user.id });
  await revokeAllForUser(user.id); // every session ends; the user must log in again

  if (user.email) sendPasswordChangedEmail(user.email, user.name);
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user || !user.isActive) throw AppError.unauthorized();
  if (!user.passwordHash) throw AppError.badRequest("This account has no password set");

  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw AppError.unauthorized("Current password is incorrect");
  }

  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_ROUNDS);
  await user.save();
  await PasswordReset.deleteMany({ userId: user.id }); // invalidate any pending reset links
  await revokeAllForUser(user.id);

  if (user.email) sendPasswordChangedEmail(user.email, user.name);
  // Keep the caller signed in on this device with a fresh session.
  return issueSession(user);
}
