import { Schema, model, type InferSchemaType } from "mongoose";

export const ROLES = ["COLLECTOR", "RECYCLER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    passwordHash: { type: String, select: false },
    role: { type: String, enum: ROLES, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Partial indexes so users without an email/phone (e.g. OTP-only collectors) don't collide.
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);
userSchema.index(
  { phone: 1 },
  { unique: true, partialFilterExpression: { phone: { $type: "string" } } },
);

export type UserDoc = InferSchemaType<typeof userSchema>;
export const User = model("User", userSchema);
