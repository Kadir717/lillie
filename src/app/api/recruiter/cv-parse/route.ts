import { NextResponse } from "next/server";
import { getRecruiterSession } from "@/lib/recruiter-auth";
import {
  CvParseError,
  extractTextFromCv,
  MAX_CV_FILE_BYTES,
} from "@/lib/cv-parse";

/**
 * POST /api/recruiter/cv-parse
 *
 * Recruiter-only endpoint: uploads a candidate's CV (PDF or DOCX) and
 * returns its extracted plain text. The text is EPHEMERAL — returned in
 * the response and never written to the database (the candidate has no
 * account on LILLIE; privacy is the default).
 *
 * Flow:
 *   1. Require a recruiter session (401 otherwise).
 *   2. Reject oversized uploads BEFORE parsing (5MB cap — DoS protection:
 *      we never run a CPU-heavy parse on a huge file).
 *   3. Parse via src/lib/cv-parse.ts, return { ok, text, charCount }.
 *
 * Status codes: 401 unauthenticated · 400 bad input / unreadable file ·
 * 500 unexpected server failure (logged, generic message to client).
 */
export async function POST(request: Request) {
  // ── Auth: recruiters only ────────────────────────────────────
  const session = await getRecruiterSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // ── Early size guard (before even buffering the body) ─────────
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_CV_FILE_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 5MB." },
      { status: 400 }
    );
  }

  // ── Multipart body ────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Invalid multipart form data." },
      { status: 400 }
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing 'file' field. Please upload a PDF or DOCX file." },
      { status: 400 }
    );
  }

  // ── Authoritative size check on the file itself ───────────────
  if (file.size > MAX_CV_FILE_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 5MB." },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromCv(buffer, file.type);
    return NextResponse.json({ ok: true, text, charCount: text.length });
  } catch (err) {
    // User errors (wrong format, scanned file, corrupted file) → 400
    // with a descriptive message. Anything unexpected → 500.
    if (err instanceof CvParseError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("CV parse failed:", err);
    return NextResponse.json(
      { error: "Something went wrong processing this file. Please try again." },
      { status: 500 }
    );
  }
}
