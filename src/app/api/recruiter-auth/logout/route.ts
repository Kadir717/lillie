import { NextResponse } from "next/server";
import { destroyRecruiterSession } from "@/lib/recruiter-auth";

/**
 * POST /api/recruiter-auth/logout
 *
 * Destroys the recruiter session cookie. Best-effort — errors are logged
 * but never fail the request; the client clears its state regardless.
 */
export async function POST() {
  try {
    await destroyRecruiterSession();
  } catch (err) {
    console.error("Recruiter session destruction failed:", err);
  }
  return NextResponse.json({ ok: true });
}
