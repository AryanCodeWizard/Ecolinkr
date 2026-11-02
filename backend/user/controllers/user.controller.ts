import type { RequestHandler } from "express";
import * as users from "../services/user.service.js";
import {
  listUsersSchema, setStatusSchema, updateMeSchema, userIdParam,
} from "../validators/user.validator.js";
import { AppError } from "../utils/AppError.js";

// "me" is always taken from the verified token, never from the URL or body.
export const getMe: RequestHandler = async (req, res) => {
  res.json({ profile: await users.getMe(req.auth!.sub, req.auth!.role) });
};

export const updateMe: RequestHandler = async (req, res) => {
  const input = updateMeSchema.parse(req.body);
  res.json({ profile: await users.updateMe(req.auth!.sub, req.auth!.role, input) });
};

export const list: RequestHandler = async (req, res) => {
  res.json(await users.listUsers(listUsersSchema.parse(req.query)));
};

export const get: RequestHandler = async (req, res) => {
  res.json({ profile: await users.getUser(userIdParam.parse(req.params.id)) });
};

export const setStatus: RequestHandler = async (req, res) => {
  const id = userIdParam.parse(req.params.id);
  const { isActive } = setStatusSchema.parse(req.body);
  if (id === req.auth!.sub && !isActive) throw AppError.badRequest("You cannot deactivate yourself");
  res.json({ profile: await users.setActive(id, isActive) });
};
