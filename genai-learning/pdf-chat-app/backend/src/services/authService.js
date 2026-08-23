// src/services/authService.js — Account creation, login, JWT issuing/verification.
// Passwords are hashed with Node's built-in scrypt (memory-hard KDF),
// stored as "salt:hash". Constant-time comparison prevents timing attacks.
import crypto from "node:crypto";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { collections } from "../db/database.js";
import { ApiError } from "../middleware/errorHandler.js";

const SCRYPT_KEYLEN = 64;
const TOKEN_TTL = "7d";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = stored.split(":");
  const expected = Buffer.from(hash, "hex");
  const candidate = crypto.scryptSync(password, salt, SCRYPT_KEYLEN);
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

function signToken(userId) {
  return jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export async function signup(email, password) {
  const normalizedEmail = email.toLowerCase();
  const existing = await collections.users().findOne({ email: normalizedEmail });
  if (existing) {
    throw new ApiError(409, "EMAIL_TAKEN", "An account with this email already exists");
  }

  const id = crypto.randomUUID();
  await collections.users().insertOne({
    _id: id,
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    createdAt: new Date(),
  });

  return { token: signToken(id), user: { id, email: normalizedEmail } };
}

export async function login(email, password) {
  const user = await collections.users().findOne({ email: email.toLowerCase() });
  // Same error for unknown email and wrong password — don't leak which is which
  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  return { token: signToken(user._id), user: { id: user._id, email: user.email } };
}

export function verifyToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET);
    return payload.sub;
  } catch {
    return null;
  }
}

export async function getUserById(id) {
  return collections.users().findOne(
    { _id: id },
    { projection: { _id: 1, email: 1, createdAt: 1 } }
  );
}
