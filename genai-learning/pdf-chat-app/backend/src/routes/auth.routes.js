// src/routes/auth.routes.js — Signup, login, and current-user endpoints.
import { Router } from "express";
import { z } from "zod";

import { signup, login, getUserById } from "../services/authService.js";
import { validate } from "../middleware/validate.js";
import { requireAuth, getGuestId } from "../middleware/auth.js";
import { getGuestQuota } from "../services/guestService.js";
import { ApiError } from "../middleware/errorHandler.js";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email address").max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
});

export const authRouter = Router();

// POST /api/auth/signup — Create account, returns JWT
authRouter.post("/signup", validate(credentialsSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    res.status(201).json(await signup(email, password));
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login — Authenticate, returns JWT
authRouter.post("/login", validate(credentialsSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    res.json(await login(email, password));
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me — Current user profile, or guest trial status
authRouter.get("/me", async (req, res, next) => {
  try {
    if (req.userId) {
      const user = await getUserById(req.userId);
      if (!user) return next(new ApiError(401, "AUTH_REQUIRED", "Account not found"));
      return res.json({ type: "user", user });
    }
    res.json({ type: "guest", quota: await getGuestQuota(getGuestId(req)) });
  } catch (err) {
    next(err);
  }
});
