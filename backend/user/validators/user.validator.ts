import { z } from "zod";
import { ROLES } from "../models/UserProfile.js";

const phone = z.string().regex(/^\+?[0-9]{10,15}$/, "Invalid phone number");
const pincode = z.string().regex(/^\d{6}$/, "Pincode must be 6 digits");

const address = z.strictObject({
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(100),
  state: z.string().trim().min(1).max(100),
  pincode,
});

// strictObject: unknown keys (role, userId, isActive...) are rejected, not ignored.
export const updateMeSchema = z
  .strictObject({
    name: z.string().trim().min(1).max(100),
    phone,
    address,
    language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, "Invalid language code"),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Provide at least one field to update" });

export const listUsersSchema = z.object({
  role: z.enum(ROLES).optional(),
  isActive: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const setStatusSchema = z.strictObject({ isActive: z.boolean() });

export const userIdParam = z.string().regex(/^[a-f\d]{24}$/i, "Invalid user id");

// Body of the auth service's sign-up notification.
export const registerUserSchema = z.strictObject({
  userId: userIdParam,
  role: z.enum(ROLES),
  name: z.string().trim().min(1).max(100),
  email: z.email().optional(),
});
