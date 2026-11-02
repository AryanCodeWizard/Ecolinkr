import { Router } from "express";
import { requireInternalKey } from "../middleware/internalAuth.js";
import * as users from "../services/user.service.js";
import { registerUserSchema } from "../validators/user.validator.js";

export const internalRouter = Router();
internalRouter.use(requireInternalKey);

// Called by the auth service whenever it creates an account.
internalRouter.post("/users", async (req, res) => {
  await users.registerUser(registerUserSchema.parse(req.body));
  res.status(204).end();
});
