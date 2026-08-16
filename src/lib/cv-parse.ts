/**
 * CV file parsing (PDF / DOCX → plain text).
 *
 * Used by recruiters to upload a candidate's CV and get the raw text for
 * later analysis. The extracted text is deliberately EPHEMERAL: this module
 * returns it to the caller and nothing is written to the database — the
 * candidate is a third party with no account on LILLIE, so privacy is the
 * default.
 *
 * ── Supported formats ───────────────────────────────────────────
 *   application/pdf                                                → pdf-parse@1.1.1
 *   application/vnd.openxmlformats-officedocument.wordprocessingml.document
 *                                                                  → mammoth (extractRawText)
 *
 * pdf-parse is pinned to 1.x on purpose: 2.x depends on @napi-rs/canvas
 * (a native binary) which is a deployment risk on Vercel. All we need is
 * text extraction, not page rendering.
 *
 * ── Defenses ────────────────────────────────────────────────────
 *   - Output is trimmed to 20,000 chars (the text will end up inside an
 *     AI prompt in a later sprint — this caps prompt cost / abuse).
 *   - Outputs shorter than 50 chars (scanned/image-only PDFs, empty
 *     documents) are rejected with a descriptive CvParseError.
 *   - Both parser internals are wrapped: details are logged server-side,
 *     users get a clean, generic message.
 *
 * NOTE: pdf-parse and mammoth ship no TypeScript declarations. They are
 * loaded via createRequire so the modules resolve at runtime without
 * needing a local .d.ts file.
 */

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// NOTE: require the inner entry (pdf-parse/lib/pdf-parse.js), NOT the
// package root. The root index.js runs a synchronous debug block when
// `module.parent` is falsy — which is always true under Next.js's webpack
// server bundle — and that block does fs.readFileSync('./test/data/...')
// which throws ENOENT at build time. The lib entry has no such block.
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  dataBuffer: Buffer
) => Promise<{ text: string }>;

interface MammothModule {
  extractRawText(input: { buffer: Buffer }): Promise<{ value: string }>;
}
const mammoth = require("mammoth") as MammothModule;

/** Maximum number of characters returned per file (AI prompt cost cap). */
export const MAX_CV_TEXT_CHARS = 20_000;

/**
 * Hard upload cap in bytes (5MB). Enforced by the API route BEFORE
 * parsing — a DoS guard so we never run a CPU-heavy parse on a huge file.
 */
export const MAX_CV_FILE_BYTES = 5 * 1024 * 1024;

/** Below this many characters the file is treated as unreadable (scanned). */
const MIN_READABLE_TEXT_CHARS = 50;

/** MIME types accepted by extractTextFromCv(). */
export const SUPPORTED_CV_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/**
 * User-facing parse error (wrong format, unreadable/scanned file, ...).
 * Route handlers map this to HTTP 400; anything else is a 500.
 */
export class CvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CvParseError";
  }
}

/**
 * Extracts plain text from a PDF or DOCX buffer.
 *
 * @param buffer   Raw file bytes (already size-checked by the caller).
 * @param mimeType The file's Content-Type. Anything outside the supported
 *                 set is rejected with a descriptive CvParseError.
 * @returns Trimmed text, capped at MAX_CV_TEXT_CHARS characters.
 * @throws CvParseError for unsupported types, unreadable output, or
 *         corrupted files (details logged, generic user message).
 */
export async function extractTextFromCv(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  let raw: string;
  switch (mimeType) {
    case "application/pdf":
      raw = await parsePdf(buffer);
      break;
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      raw = await parseDocx(buffer);
      break;
    default:
      throw new CvParseError(
        "Unsupported file type. Please upload a PDF or DOCX file."
      );
  }

  const trimmed = raw.trim();
  if (trimmed.length < MIN_READABLE_TEXT_CHARS) {
    throw new CvParseError(
      "Couldn't extract readable text from this file. It may be a scanned/image-only document."
    );
  }
  return trimmed.slice(0, MAX_CV_TEXT_CHARS);
}

async function parsePdf(buffer: Buffer): Promise<string> {
  try {
    const result = await pdfParse(buffer);
    return result.text;
  } catch (err) {
    console.error("PDF text extraction failed:", err);
    throw new CvParseError(
      "Couldn't read this PDF file — it may be corrupted or password-protected."
    );
  }
}

async function parseDocx(buffer: Buffer): Promise<string> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  } catch (err) {
    console.error("DOCX text extraction failed:", err);
    throw new CvParseError("Couldn't read this DOCX file — it may be corrupted.");
  }
}
