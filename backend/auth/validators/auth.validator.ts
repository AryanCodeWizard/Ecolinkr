import { z } from "zod";

export const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email().toLowerCase(),
  password: passwordSchema,
  // Admins are never self-registered; collectors will use OTP login (later step).
  role: z.literal("RECYCLER").default("RECYCLER"),
});

export const loginSchema = z.object({
  email: z.email().toLowerCase(),
  password: z.string().min(1).max(128),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1).max(512),
});

export const otpRequestSchema = z.object({
  email: z.email().toLowerCase(),
});

export const otpVerifySchema = z.object({
  email: z.email().toLowerCase(),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
  name: z.string().trim().min(1).max(100).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1).max(256),
  newPassword: passwordSchema,
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .refine((v) => v.currentPassword !== v.newPassword, {
    message: "New password must differ from the current password",
    path: ["newPassword"],
  });
