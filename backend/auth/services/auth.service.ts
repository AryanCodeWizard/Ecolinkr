import bcrypt from "bcrypt";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { shouldAlertNewDevice } from "./device.service.js";
import { sendLoginAlertEmail, sendWelcomeEmail, type RequestContext } from "./email.service.js";
import { syncUser } from "./userSync.service.js";
import { issueSession } from "./refreshToken.service.js";
import type { LoginInput, RegisterInput } from "../validators/auth.validator.js";

// Compared against when the email is unknown so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("dummy-password", 10);

function publicUser(u: { id: string; name: string; email?: string | null; role: string }) {
  return { id: u.id, name: u.name, email: u.email, role: u.role };
}

export async function register(input: RegisterInput, ctx: RequestContext) {
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  try {
    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
    });
    void syncUser(user);
    await shouldAlertNewDevice(user.id, ctx); // records the first device silently
    sendWelcomeEmail(input.email, user.name);
    return {
      user: publicUser(user),
      ...(await issueSession(user)),
    };
  } catch (err: any) {
    if (err?.code === 11000) throw AppError.conflict("Email already registered");
    throw err;
  }
}

export async function login(input: LoginInput, ctx: RequestContext) {
  const user = await User.findOne({ email: input.email }).select("+passwordHash");
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok || !user.isActive) throw AppError.unauthorized("Invalid email or password");
  if (await shouldAlertNewDevice(user.id, ctx)) sendLoginAlertEmail(input.email, user.name, ctx);
  return {
    user: publicUser(user),
    ...(await issueSession(user)),
  };
}
