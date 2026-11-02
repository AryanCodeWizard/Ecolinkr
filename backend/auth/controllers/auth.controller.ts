import type { Request, RequestHandler } from "express";
import {
  changePasswordSchema, forgotPasswordSchema, resetPasswordSchema,
} from "../validators/auth.validator.js";
import { loginSchema, otpRequestSchema, otpVerifySchema, refreshSchema, registerSchema } from "../validators/auth.validator.js";
import * as authService from "../services/auth.service.js";
import { changePassword, forgotPassword, resetPassword } from "../services/password.service.js";
import { requestOtp, verifyOtp } from "../services/otp.service.js";
import { revoke, rotate } from "../services/refreshToken.service.js";

const ctxOf = (req: Request) => {
  const deviceId = req.get("x-device-id");
  return {
    ip: req.ip,
    userAgent: req.get("user-agent"),
    deviceId: deviceId && deviceId.length <= 128 ? deviceId : undefined,
  };
};

export const register: RequestHandler = async (req, res) => {
  const input = registerSchema.parse(req.body);
  res.status(201).json(await authService.register(input, ctxOf(req)));
};

export const login: RequestHandler = async (req, res) => {
  const input = loginSchema.parse(req.body);
  res.json(await authService.login(input, ctxOf(req)));
};

export const refresh: RequestHandler = async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  res.json(await rotate(refreshToken));
};

export const logout: RequestHandler = async (req, res) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  await revoke(refreshToken);
  res.status(204).end();
};

export const me: RequestHandler = (req, res) => {
  res.json({ user: req.auth });
};

export const otpRequest: RequestHandler = async (req, res) => {
  const { email } = otpRequestSchema.parse(req.body);
  await requestOtp(email);
  // Same response whether or not the email is known.
  res.status(202).json({ message: "If the email is eligible, a code has been sent" });
};

export const otpVerify: RequestHandler = async (req, res) => {
  const input = otpVerifySchema.parse(req.body);
  res.json(await verifyOtp(input, ctxOf(req)));
};

export const forgotPasswordHandler: RequestHandler = async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  await forgotPassword(email);
  res.status(202).json({ message: "If the email is registered, a reset link has been sent" });
};

export const resetPasswordHandler: RequestHandler = async (req, res) => {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);
  await resetPassword(token, newPassword);
  res.json({ message: "Password updated. Please log in again." });
};

export const changePasswordHandler: RequestHandler = async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);
  res.json(await changePassword(req.auth!.sub, currentPassword, newPassword));
};
