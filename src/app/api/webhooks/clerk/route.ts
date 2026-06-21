import type { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { deleteProfileByClerkId } from "@/services/profile";

// Clerk webhook receiver. Currently handles user.deleted: when a user deletes
// their account (or is deleted in the Clerk dashboard), we remove their local
// profile, which cascade-deletes all of their data. This is what makes the
// privacy policy's "delete your account -> data is removed" actually true.
//
// Setup: in the Clerk Dashboard add an endpoint pointing at /api/webhooks/clerk
// subscribed to user.deleted, and set CLERK_WEBHOOK_SIGNING_SECRET (the signing
// secret Clerk shows for that endpoint). verifyWebhook validates the Svix
// signature using that secret, so unsigned/forged requests are rejected.
export async function POST(req: NextRequest) {
  let event;
  try {
    event = await verifyWebhook(req);
  } catch {
    // Bad/missing signature, or the secret isn't configured. 400 tells Clerk the
    // delivery failed so it retries; we never act on an unverified payload.
    return new Response("Invalid webhook signature", { status: 400 });
  }

  if (event.type === "user.deleted") {
    // `deleted` events can be partial; only the id is guaranteed.
    const clerkUserId = event.data.id;
    if (clerkUserId) {
      try {
        const removed = await deleteProfileByClerkId(clerkUserId);
        return Response.json({ ok: true, removed });
      } catch {
        // Let Clerk retry on a transient DB error rather than dropping the event.
        return new Response("Failed to delete profile", { status: 500 });
      }
    }
  }

  // Acknowledge everything else so Clerk doesn't retry events we don't act on.
  return Response.json({ ok: true });
}
