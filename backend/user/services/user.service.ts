import { UserProfile, type Role } from "../models/UserProfile.js";
import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import type { z } from "zod";
import type { listUsersSchema, registerUserSchema, updateMeSchema } from "../validators/user.validator.js";

const isDuplicate = (err: any) => err?.code === 11000;

// The profile is created implicitly on first access: the auth service owns sign-up,
// so any valid token already identifies a user this service has not seen yet.
async function upsertProfile(userId: string, role: Role, set: Record<string, unknown> = {}) {
  const run = () =>
    UserProfile.findOneAndUpdate(
      { userId },
      { $set: set, $setOnInsert: { userId, role } },
      { upsert: true, returnDocument: "after", runValidators: true, setDefaultsOnInsert: true },
    ).select("-__v");
  try {
    return await run();
  } catch (err) {
    if (isDuplicate(err)) return run(); // lost a concurrent-upsert race; the doc exists now
    throw err;
  }
}

export const getMe = (userId: string, role: Role) => upsertProfile(userId, role);

export const updateMe = (userId: string, role: Role, input: z.infer<typeof updateMeSchema>) =>
  upsertProfile(userId, role, input);

export async function listUsers({ role, isActive, page, limit }: z.infer<typeof listUsersSchema>) {
  const filter = {
    ...(role && { role }),
    ...(isActive !== undefined && { isActive }),
  };
  const [items, total] = await Promise.all([
    UserProfile.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).select("-__v"),
    UserProfile.countDocuments(filter),
  ]);
  return { items, page, limit, total };
}

export async function getUser(userId: string) {
  const profile = await UserProfile.findOne({ userId }).select("-__v");
  if (!profile) throw AppError.notFound("User not found");
  return profile;
}

// Records a user created in the auth service. Idempotent: replays never overwrite edits the user made.
export async function registerUser(input: z.infer<typeof registerUserSchema>) {
  const { userId, role, ...fields } = input;
  try {
    await UserProfile.updateOne(
      { userId },
      { $setOnInsert: { userId, role, ...fields } },
      { upsert: true },
    );
  } catch (err) {
    if (!isDuplicate(err)) throw err; // lost a concurrent-upsert race; the doc exists now
  }
}

// The auth service owns login, so it must accept the change first; only then do we record it.
async function syncStatusToAuth(userId: string, isActive: boolean) {
  let res: Response;
  try {
    res = await fetch(`${env.AUTH_SERVICE_URL}/internal/users/${userId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "X-Internal-Key": env.INTERNAL_API_KEY },
      body: JSON.stringify({ isActive }),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    throw new AppError(502, "AUTH_UNAVAILABLE", "Auth service is unreachable");
  }
  if (res.status === 404) throw AppError.notFound("User not found");
  if (!res.ok) throw new AppError(502, "AUTH_ERROR", `Auth service returned ${res.status}`);
}

export async function setActive(userId: string, isActive: boolean) {
  const exists = await UserProfile.exists({ userId });
  if (!exists) throw AppError.notFound("User not found");
  await syncStatusToAuth(userId, isActive);
  return UserProfile.findOneAndUpdate({ userId }, { $set: { isActive } }, { returnDocument: "after" })
    .select("-__v");
}
