import { Router } from "express";
import { z } from "zod";
import { requireInternalKey } from "../middleware/internalAuth.js";
import { User } from "../models/User.js";
import { revokeAllForUser } from "../services/refreshToken.service.js";
import { AppError } from "../utils/AppError.js";

export const internalRouter = Router();
internalRouter.use(requireInternalKey);

// Called by the user service when an admin activates/deactivates an account.
internalRouter.patch("/users/:id/status", async (req, res) => {
  const id = z.string().regex(/^[a-f\d]{24}$/i).parse(req.params.id);
  const { isActive } = z.strictObject({ isActive: z.boolean() }).parse(req.body);
  const user = await User.findByIdAndUpdate(id, { isActive });
  if (!user) throw AppError.notFound("User not found");
  if (!isActive) await revokeAllForUser(id);
  res.json({ id, isActive });
});
