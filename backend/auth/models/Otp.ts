import { Schema, model } from "mongoose";

const otpSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    // HMAC of the code; the raw code is only ever emailed.
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Otp = model("Otp", otpSchema);
