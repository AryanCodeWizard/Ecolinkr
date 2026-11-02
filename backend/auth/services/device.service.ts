import { createHash } from "node:crypto";
import { KnownDevice } from "../models/KnownDevice.js";
import type { RequestContext } from "./email.service.js";

/**
 * Prefer an app-supplied device ID. Otherwise fall back to the User-Agent with version
 * numbers stripped, so browser/app updates don't look like a new device.
 */
function fingerprint(ctx: RequestContext): string {
  const source = ctx.deviceId
    ? `id:${ctx.deviceId}`
    : `ua:${(ctx.userAgent ?? "unknown").toLowerCase().replace(/[\d._]+/g, "")}`;
  return createHash("sha256").update(source).digest("hex");
}

/**
 * Record this sign-in's device. Returns true only if the device is new AND the user
 * already had other devices, i.e. when a "new device" alert is warranted. A user's
 * very first device (right after signup) is recorded silently.
 */
export async function recordDevice(userId: string, ctx: RequestContext): Promise<boolean> {
  const now = new Date();
  const res = await KnownDevice.findOneAndUpdate(
    { userId, fingerprint: fingerprint(ctx) },
    {
      $set: { lastSeenAt: now, lastIp: ctx.ip },
      $setOnInsert: { firstSeenAt: now, firstIp: ctx.ip, userAgent: ctx.userAgent?.slice(0, 300) },
    },
    { upsert: true, includeResultMetadata: true },
  );
  const isNew = res.lastErrorObject?.updatedExisting === false;
  if (!isNew) return false;
  return (await KnownDevice.countDocuments({ userId })) > 1;
}

/** Device tracking must never break a login: on any failure, skip the alert. */
export async function shouldAlertNewDevice(userId: string, ctx: RequestContext): Promise<boolean> {
  try {
    return await recordDevice(userId, ctx);
  } catch (err) {
    console.error("Device tracking failed:", (err as Error).message);
    return false;
  }
}
