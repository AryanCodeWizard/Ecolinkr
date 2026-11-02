import { Router } from "express";
import * as user from "../controllers/user.controller.js";
import { requireActive, requireAuth, requireRole } from "../middleware/auth.js";

export const userRouter = Router();
userRouter.use(requireAuth);

userRouter.get("/me", requireActive, user.getMe);
userRouter.patch("/me", requireActive, user.updateMe);

userRouter.get("/", requireRole("ADMIN"), user.list);
userRouter.get("/:id", requireRole("ADMIN"), user.get);
userRouter.patch("/:id/status", requireRole("ADMIN"), user.setStatus);
