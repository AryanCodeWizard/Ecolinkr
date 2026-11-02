import { Schema, model, Types } from "mongoose";

const knownDeviceSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true },
  fingerprint: { type: String, required: true },
  userAgent: { type: String },
  firstIp: { type: String },
  lastIp: { type: String },
  firstSeenAt: { type: Date, required: true },
  lastSeenAt: { type: Date, required: true },
});

knownDeviceSchema.index({ userId: 1, fingerprint: 1 }, { unique: true });
// Devices not seen for a year are forgotten, so a returning one triggers an alert again.
knownDeviceSchema.index({ lastSeenAt: 1 }, { expireAfterSeconds: 365 * 86_400 });

export const KnownDevice = model("KnownDevice", knownDeviceSchema);
