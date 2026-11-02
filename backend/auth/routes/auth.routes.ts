import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { byEmail, byIp, byUser, rateLimit } from "../middleware/rateLimit.js";

export const authRouter = Router();

const MIN = 60;

authRouter.post(
  "/register",
  rateLimit({ name: "register:ip", windowSec: 60 * MIN, max: 10, key: byIp }),
  rateLimit({ name: "register:email", windowSec: 60 * MIN, max: 3, key: byEmail }),
  authController.register,
);
authRouter.post(
  "/login",
  rateLimit({ name: "login:ip", windowSec: 15 * MIN, max: 30, key: byIp }),
  rateLimit({ name: "login:email", windowSec: 15 * MIN, max: 5, key: byEmail }),
  authController.login,
);
authRouter.post(
  "/otp/request",
  rateLimit({ name: "otp-request:ip", windowSec: 15 * MIN, max: 10, key: byIp }),
  rateLimit({ name: "otp-request:email", windowSec: 15 * MIN, max: 3, key: byEmail }),
  authController.otpRequest,
);
authRouter.post(
  "/otp/verify",
  rateLimit({ name: "otp-verify:ip", windowSec: 15 * MIN, max: 30, key: byIp }),
  rateLimit({ name: "otp-verify:email", windowSec: 15 * MIN, max: 10, key: byEmail }),
  authController.otpVerify,
);
authRouter.post(
  "/refresh",
  rateLimit({ name: "refresh:ip", windowSec: MIN, max: 30, key: byIp }),
  authController.refresh,
);
authRouter.post(
  "/logout",
  rateLimit({ name: "logout:ip", windowSec: MIN, max: 30, key: byIp }),
  authController.logout,
);
authRouter.get("/me", requireAuth, authController.me);

authRouter.post(
  "/password/forgot",
  rateLimit({ name: "pw-forgot:ip", windowSec: 15 * MIN, max: 10, key: byIp }),
  rateLimit({ name: "pw-forgot:email", windowSec: 60 * MIN, max: 3, key: byEmail }),
  authController.forgotPasswordHandler,
);
authRouter.post(
  "/password/reset",
  rateLimit({ name: "pw-reset:ip", windowSec: 15 * MIN, max: 20, key: byIp }),
  authController.resetPasswordHandler,
);
authRouter.post(
  "/password/change",
  requireAuth,
  rateLimit({ name: "pw-change:user", windowSec: 15 * MIN, max: 5, key: byUser }),
  authController.changePasswordHandler,
);
