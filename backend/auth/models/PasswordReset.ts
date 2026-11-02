import { Schema, model, Types } from "mongoose";

const passwordResetSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    // SHA-256 of the emailed token; the raw token is never stored.
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordReset = model("PasswordReset", passwordResetSchema);
