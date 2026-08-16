import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createRecruiterSession,
  hashPassword,
  isConsumerEmailDomain,
  isValidEmail,
  isValidPassword,
} from "@/lib/recruiter-auth";

/**
 * POST /api/recruiter-auth/signup
 *
 * Creates a recruiter (company) account with email + password and starts
 * a recruiter session. Fully independent of the GitHub OAuth User flow.
 *
 * Validates input manually (no zod): email format, consumer-domain
 * blocklist, password policy. Returns 201 on success, 400 for invalid
 * input, 409 if the email is already registered, 500 on server error.
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

  const { email, password, companyName } = (body ?? {}) as Record<
    string,
    unknown
  >;

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!isValidEmail(normalizedEmail)) {
    return NextResponse.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  if (isConsumerEmailDomain(normalizedEmail)) {
    return NextResponse.json(
      {
        error:
          "Recruiter accounts need a company email address — consumer mailboxes (gmail.com, yahoo.com, ...) are not accepted.",
      },
      { status: 400 }
    );
  }

  if (!isValidPassword(password)) {
    return NextResponse.json(
      {
        error: "Password must be at least 8 characters long (max 128).",
      },
      { status: 400 }
    );
  }

  const company =
    typeof companyName === "string" ? companyName.trim().slice(0, 120) : null;

  try {
    const existing = await prisma.recruiter.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in." },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const recruiter = await prisma.recruiter.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        companyName: company,
      },
      select: { id: true, email: true, companyName: true },
    });

    await createRecruiterSession({
      type: "recruiter",
      recruiterId: recruiter.id,
      email: recruiter.email,
    });

    return NextResponse.json(
      { ok: true, recruiter },
      { status: 201 }
    );
  } catch (err) {
    // Two concurrent signups with the same email can both pass the
    // findUnique check above; the unique constraint catches the loser.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this email already exists. Try signing in." },
        { status: 409 }
      );
    }
    console.error("Recruiter signup failed:", err);
    return NextResponse.json(
      { error: "Something went wrong creating your account. Please try again." },
      { status: 500 }
    );
  }
}
