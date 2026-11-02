import { Schema, model, type InferSchemaType } from "mongoose";

export const ROLES = ["COLLECTOR", "RECYCLER", "ADMIN"] as const;
export type Role = (typeof ROLES)[number];

const addressSchema = new Schema(
  {
    line1: { type: String, required: true, trim: true },
    line2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    pincode: { type: String, required: true },
  },
  { _id: false },
);

// One document per auth-service user. `userId` is the auth user's id (the JWT `sub`);
// there is no cross-database reference, so it is stored as a plain string.
const userProfileSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true },
    role: { type: String, enum: ROLES, required: true },
    name: { type: String, trim: true },
    email: { type: String, lowercase: true, trim: true },
    phone: { type: String, trim: true },
    address: { type: addressSchema },
    language: { type: String, default: "en" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

userProfileSchema.index({ role: 1, createdAt: -1 });

export type UserProfileDoc = InferSchemaType<typeof userProfileSchema>;
export const UserProfile = model("UserProfile", userProfileSchema, "profiles");
