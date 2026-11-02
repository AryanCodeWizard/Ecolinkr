import { Schema, model, Types } from "mongoose";

const refreshTokenSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    // SHA-256 of the opaque token; the raw token is never stored.
    tokenHash: { type: String, required: true, unique: true },
    // All tokens descended from one login share a family, so reuse can revoke the whole chain.
    family: { type: String, required: true, index: true },
    revokedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);

// MongoDB removes documents automatically once expiresAt has passed.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = model("RefreshToken", refreshTokenSchema);
