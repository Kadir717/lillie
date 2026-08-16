import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createRecruiterSession,
  isValidEmail,
  isValidPassword,
  verifyPassword,
} from "@/lib/recruiter-auth";

// Constant dummy digest used to burn a comparable scrypt verification when
// the email is unknown — prevents timing-based user enumeration. (Matches
// the "salt:hash" format; the hash is arbitrary, only its cost matters.)
const DUMMY_HASH =
  "00000000000000000000000000000000:" +
  "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * POST /api/recruiter-auth/login
 *
 * Authenticates a recruiter with email + password and starts a session.
 * Returns 400 for malformed input, 401 for wrong credentials (generic
 * message, no account-existence leak), 500 on server error.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const { email, password } = (body ?? {}) as Record<string, unknown>;

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  // Format checks first: invalid input is a 400, wrong credentials are a 401.
  if (!isValidEmail(normalizedEmail) || !isValidPassword(password)) {
    return NextResponse.json(
      { error: "Invalid email or password." },
      { status: 401 }
    );
  }

  try {
    const recruiter = await prisma.recruiter.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, passwordHash: true, companyName: true },
    });

    // Unknown email: still run a scrypt verification against a dummy
    // digest so response time doesn't reveal whether the account exists.
    const valid = recruiter
      ? await verifyPassword(password, recruiter.passwordHash)
      : await verifyPassword(password, DUMMY_HASH);

    if (!recruiter || !valid) {
      return NextResponse.json(
        { error: "Invalid email or password." },
        { status: 401 }
      );
    }

    await createRecruiterSession({
      type: "recruiter",
      recruiterId: recruiter.id,
      email: recruiter.email,
    });

    return NextResponse.json({
      ok: true,
      recruiter: {
        id: recruiter.id,
        email: recruiter.email,
        companyName: recruiter.companyName,
      },
    });
  } catch (err) {
    console.error("Recruiter login failed:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
