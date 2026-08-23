// src/services/guestService.js — Free-trial quota tracking for anonymous users.
// Guests are identified by a client-generated UUID (x-guest-id header).
// NOTE: in production, combine this with IP-based limits — a shared client ID
// can be reset by clearing localStorage. Rate limits still cap total abuse.
import { env } from "../config/env.js";
import { collections } from "../db/database.js";

export async function getGuestUploadsUsed(guestId) {
  if (!guestId) return 0;
  const doc = await collections.guestUsage().findOne({ _id: guestId });
  return doc?.uploadsUsed ?? 0;
}

export async function getGuestQuota(guestId) {
  const used = await getGuestUploadsUsed(guestId);
  return {
    used,
    limit: env.GUEST_FREE_UPLOADS,
    remaining: Math.max(0, env.GUEST_FREE_UPLOADS - used),
  };
}

export async function hasGuestQuota(guestId) {
  return (await getGuestUploadsUsed(guestId)) < env.GUEST_FREE_UPLOADS;
}

export async function recordGuestUpload(guestId) {
  if (!guestId) return;
  await collections.guestUsage().updateOne(
    { _id: guestId },
    {
      $inc: { uploadsUsed: 1 },
      $set: { updatedAt: new Date() },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true }
  );
}
