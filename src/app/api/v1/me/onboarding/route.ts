import { connection, NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentProfile } from "@/services/profile";
import { submitOnboarding } from "@/services/onboarding";
import { onboardingInput } from "@/lib/contracts/onboarding";
import { defaultEmbedder } from "@/lib/taste/embedder";
import { jsonError } from "@/lib/api";

export const maxDuration = 60;

export async function POST(req: Request) {
  await connection();
  const profile = await getCurrentProfile();
  if (!profile) return jsonError(401, "Sign in required");
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return jsonError(400, "Invalid JSON body");
    }
    const input = onboardingInput.parse(body);
    const result = await submitOnboarding(profile.id, input, defaultEmbedder());
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ZodError) return jsonError(400, "Validation failed", err.issues);
    console.error(err);
    return jsonError(500, "Onboarding failed");
  }
}
