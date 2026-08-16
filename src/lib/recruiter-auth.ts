/**
 * Recruiter authentication and session management for LILLIE.
 *
 * ── Overview ────────────────────────────────────────────────────
 * LILLIE supports two fully independent user types:
 *   - User       → GitHub OAuth (src/lib/auth.ts, cookie: lillie_session)
 *   - Recruiter  → email + password (this module, cookie: lillie_recruiter_session)
 *
 * They are deliberately isolated: separate cookie names, a `type:
 * "recruiter"` JWT claim, and no Prisma relations between the two
 * tables. Any consumer of a recruiter session MUST check the `type`
 * claim — a recruiter token can never be used on User routes and vice
 * versa (getRecruiterSession() rejects payloads without type "recruiter").
 *
 * ── Password hashing ────────────────────────────────────────────
 * Node's built-in crypto.scrypt (async, promisified) — no external
 * dependency (bcrypt/argon2 intentionally avoided). scrypt is a
 * memory-hard KDF, appropriate for this scale. The stored value is a
 * single string in "salt:hash" (hex) format; bcrypt/argon2 could be
 * swapped in later without changing the column.
 *
 * ── Session design ──────────────────────────────────────────────
 * Same pattern as the User session (see src/lib/auth.ts): stateless
 * JWT signed with jose (HS256), 7-day httpOnly cookie, sameSite lax,
 * secure in production. The signing secret is the SAME SESSION_SECRET
 * env var used by auth.ts — no new environment variable.
 *
 * ── Email policy ────────────────────────────────────────────────
 * Recruiters represent a company, so consumer mailbox domains are
 * rejected at signup. This is a soft policy check (reduces fake /
 * abusive signups), not a security boundary.
 *
 * ── Environment Variables ───────────────────────────────────────
 *   SESSION_SECRET — shared with the User auth module (REQUIRED in prod)
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { randomBytes, scrypt as _scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(_scrypt) as (
  password: string,
  salt: string,
  keylen: number
) => Promise<Buffer>;

const RECRUITER_COOKIE = "lillie_recruiter_session";

// scrypt parameters (N=16384, r=8, p=1 is Node's default). The digest is
// stored as "salt:hash" hex — salt is 16 random bytes, hash is 64 bytes.
const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_LEN = 16;

/** Minimum/maximum password length enforced at signup and login. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Returns the signing secret for recruiter JWTs.
 *
 * Mirrors getSigningSecret() in src/lib/auth.ts — deliberately kept local
 * (rather than exported from auth.ts) so this module is fully
 * self-contained and the existing User auth module stays untouched.
 * Uses the SAME SESSION_SECRET env var: production fails fast when it is
 * missing, development uses the documented insecure fallback.
 */
function getSigningSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "SESSION_SECRET is required in production.\n" +
          "Generate one: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"\n" +
          "Then add it to your Vercel environment variables."
      );
    }
    console.warn(
      "⚠️  LILLIE: SESSION_SECRET not set. Using dev-only fallback.\n" +
        "   This is INSECURE for production. Set SESSION_SECRET in your .env.local file."
    );
    return new TextEncoder().encode("dev-only-insecure-secret-change-me");
  }
  return new TextEncoder().encode(secret);
}

// ── Password hashing ─────────────────────────────────────────────

/**
 * Hashes a password with scrypt, returning "salt:hash" (hex).
 * The salt is generated fresh per call, so identical passwords
 * produce different digests.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_LEN).toString("hex");
  const hash = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `${salt}:${hash.toString("hex")}`;
}

/**
 * Verifies a password against a stored "salt:hash" digest.
 * Uses timingSafeEqual so comparison time does not leak the digest.
 * Returns false for malformed stored values (never throws).
 */
export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  try {
    const expected = Buffer.from(hashHex, "hex");
    const actual = await scrypt(password, salt, expected.length);
    return (
      actual.length === expected.length && timingSafeEqual(actual, expected)
    );
  } catch {
    return false;
  }
}

// ── Email validation ─────────────────────────────────────────────

/** Mailbox domains not accepted for recruiter accounts. */
const CONSUMER_EMAIL_DOMAINS = new Set([
  "gmail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "icloud.com",
  "aol.com",
  "protonmail.com",
  "live.com",
  "yandex.com",
]);

/** Loose but useful email format check (no external validator). */
export function isValidEmail(email: string): boolean {
  if (email.length < 3 || email.length > 254) return false;
  const at = email.indexOf("@");
  if (at <= 0 || at !== email.lastIndexOf("@")) return false;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  return (
    local.length > 0 &&
    domain.includes(".") &&
    domain.length >= 3 &&
    !domain.startsWith(".") &&
    !domain.endsWith(".")
  );
}

/**
 * True when the email's domain is a consumer mailbox provider.
 * Recruiter accounts must use a company email address.
 */
export function isConsumerEmailDomain(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain ? CONSUMER_EMAIL_DOMAINS.has(domain) : false;
}

/** Password policy: 8-128 chars. The 128 cap bounds scrypt cost per request. */
export function isValidPassword(password: string): boolean {
  return (
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH
  );
}

// ── Session ──────────────────────────────────────────────────────

/**
 * Session payload stored inside the recruiter JWT.
 * `type` is always "recruiter" — consumers MUST check it so a recruiter
 * token can never be accepted where a User token (or vice versa) belongs.
 */
export interface RecruiterSessionPayload {
  type: "recruiter";
  recruiterId: string;
  email: string;
}

/**
 * Creates a signed, httpOnly recruiter session cookie.
 * Same cookie flags as the User session: httpOnly, secure in prod,
 * sameSite lax, 7-day maxAge, path "/".
 */
export async function createRecruiterSession(
  payload: RecruiterSessionPayload
) {
  const secret = getSigningSecret();
  const token = await new SignJWT({
    ...payload,
    type: "recruiter", // always force the claim, never trust callers
  } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(RECRUITER_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/**
 * Reads and verifies the recruiter session cookie.
 * Returns null when the cookie is missing, expired, malformed, OR the
 * `type` claim is not "recruiter" (e.g. a User JWT signed with the same
 * secret — it must never authenticate as a recruiter).
 */
export async function getRecruiterSession(): Promise<RecruiterSessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(RECRUITER_COOKIE)?.value;
  if (!token) return null;

  try {
    const secret = getSigningSecret();
    const { payload } = await jwtVerify(token, secret);
    if (payload.type !== "recruiter") return null;
    return payload as unknown as RecruiterSessionPayload;
  } catch {
    return null;
  }
}

/** Deletes the recruiter session cookie (client-side, best-effort). */
export async function destroyRecruiterSession() {
  const cookieStore = await cookies();
  cookieStore.delete(RECRUITER_COOKIE);
}
