import { createHash, randomBytes, randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { RefreshToken } from "../models/RefreshToken.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { signAccessToken } from "./token.service.js";

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

async function createRefreshToken(userId: string, family: string) {
  const token = randomBytes(48).toString("base64url");
  await RefreshToken.create({
    userId,
    tokenHash: hash(token),
    family,
    expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
  });
  return token;
}

/** Start a new session (new token family) for a user. */
export async function issueSession(user: { id: string; role: any }) {
  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken: await createRefreshToken(user.id, randomUUID()),
  };
}

/** Exchange a refresh token for a new pair; the presented token is single-use. */
export async function rotate(rawToken: string) {
  const now = new Date();
  // Atomically claim the token so two concurrent refreshes can't both succeed.
  const claimed = await RefreshToken.findOneAndUpdate(
    { tokenHash: hash(rawToken), revokedAt: { $exists: false }, expiresAt: { $gt: now } },
    { revokedAt: now },
  );

  if (!claimed) {
    // An already-used token being replayed suggests theft: kill the whole family.
    const known = await RefreshToken.findOne({ tokenHash: hash(rawToken) });
    if (known?.revokedAt) await RefreshToken.deleteMany({ family: known.family });
    throw AppError.unauthorized("Invalid refresh token");
  }

  const user = await User.findById(claimed.userId);
  if (!user || !user.isActive) {
    await RefreshToken.deleteMany({ family: claimed.family });
    throw AppError.unauthorized("Invalid refresh token");
  }

  return {
    accessToken: signAccessToken({ sub: user.id, role: user.role }),
    refreshToken: await createRefreshToken(user.id, claimed.family),
  };
}

/** Revoke the session a refresh token belongs to. Idempotent. */
export async function revoke(rawToken: string) {
  const known = await RefreshToken.findOne({ tokenHash: hash(rawToken) });
  if (known) await RefreshToken.deleteMany({ family: known.family });
}

/** Sign a user out everywhere (used after a password change). */
export async function revokeAllForUser(userId: string) {
  await RefreshToken.deleteMany({ userId });
}
