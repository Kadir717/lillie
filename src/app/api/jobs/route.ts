import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JOB_STATUSES, JOB_PRIORITIES, type JobStatus, type JobPriority } from "@/lib/jobs/types";
import { getUserEntitlements } from "@/lib/billing/entitlements";
import { checkLimit, limitMessage } from "@/lib/billing/usage";

/**
 * GET /api/jobs
 *
 * Lists all jobs tracked by the authenticated user, newest first.
 * The cached `matchScore` is included so the list can show fit without
 * recomputing; the full snapshot lives in `matchJson` (not returned here
 * to keep the list light — use GET /api/jobs/[id] for the detail view).
 *
 * Responses:
 *   200 — { jobs: [...] }
 *   401 — not authenticated
 *   500 — unexpected failure
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { githubId: session.githubId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const jobs = await prisma.job.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        company: true,
        title: true,
        url: true,
        description: true,
        status: true,
        priority: true,
        matchScore: true,
        appliedAt: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      jobs: jobs.map((j) => ({
        ...j,
        appliedAt: j.appliedAt?.toISOString() ?? null,
        deadline: j.deadline?.toISOString() ?? null,
        createdAt: j.createdAt.toISOString(),
        updatedAt: j.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    console.error("Failed to list jobs:", err);
    return NextResponse.json({ error: "Failed to load jobs" }, { status: 500 });
  }
}

/**
 * POST /api/jobs
 *
 * Creates a new tracked job.
 *
 * Request body:
 *   {
 *     company: string (required, ≤120 chars),
 *     title: string (required, ≤120 chars),
 *     url?: string,
 *     description?: string,
 *     status?: "saved" | "applied" | "interviewing" | "offer" | "rejected" | "archived",
 *     priority?: "low" | "medium" | "high",
 *     notes?: string,
 *     appliedAt?: ISO string,
 *     deadline?: ISO string
 *   }
 *
 * Responses:
 *   201 — { job }
 *   400 — invalid body / fields
 *   401 — not authenticated
 *   404 — user not found
 *   500 — unexpected failure
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  // ── Validate required fields ──────────────────────────────────
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!company || company.length > 120) {
    return NextResponse.json(
      { error: "Company is required and must be 120 characters or fewer" },
      { status: 400 }
    );
  }
  if (!title || title.length > 120) {
    return NextResponse.json(
      { error: "Title is required and must be 120 characters or fewer" },
      { status: 400 }
    );
  }

  // ── Validate optional fields ──────────────────────────────────
  let status: JobStatus = "saved";
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !JOB_STATUSES.includes(body.status as JobStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Supported: ${JOB_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    status = body.status as JobStatus;
  }

  let priority: JobPriority = "medium";
  if (body.priority !== undefined) {
    if (typeof body.priority !== "string" || !JOB_PRIORITIES.includes(body.priority as JobPriority)) {
      return NextResponse.json(
        { error: `Invalid priority. Supported: ${JOB_PRIORITIES.join(", ")}` },
        { status: 400 }
      );
    }
    priority = body.priority as JobPriority;
  }

  const url = typeof body.url === "string" ? body.url.trim().slice(0, 500) : null;
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, 20_000) : null;

  // Consistent with PATCH: present-but-invalid dates are rejected, null is
  // allowed (means "not set").
  const parseDate = (v: unknown): { ok: boolean; value: Date | null } => {
    if (v === undefined || v === null) return { ok: true, value: null };
    if (typeof v !== "string") return { ok: false, value: null };
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return { ok: false, value: null };
    return { ok: true, value: d };
  };

  const appliedAtParsed = parseDate(body.appliedAt);
  const deadlineParsed = parseDate(body.deadline);
  if (!appliedAtParsed.ok || !deadlineParsed.ok) {
    return NextResponse.json(
      { error: "appliedAt and deadline must be valid date strings or null" },
      { status: 400 }
    );
  }
  const appliedAt = appliedAtParsed.value;
  const deadline = deadlineParsed.value;

  try {
    const billing = await getUserEntitlements(session.githubId);
    if (!billing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const { id: userId, entitlements } = billing;

    // ── Entitlement: tracked-job count limit ─────────────────────
    const jobLimit = await checkLimit(userId, "jobs", entitlements);
    if (!jobLimit.allowed) {
      return NextResponse.json(
        { error: limitMessage("jobs", jobLimit) },
        { status: 403 }
      );
    }

    const job = await prisma.job.create({
      data: { userId, company, title, url, description, status, priority, notes, appliedAt, deadline },
      select: {
        id: true,
        company: true,
        title: true,
        url: true,
        description: true,
        status: true,
        priority: true,
        notes: true,
        matchScore: true,
        appliedAt: true,
        deadline: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(
      {
        job: {
          ...job,
          appliedAt: job.appliedAt?.toISOString() ?? null,
          deadline: job.deadline?.toISOString() ?? null,
          createdAt: job.createdAt.toISOString(),
          updatedAt: job.updatedAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("Failed to create job:", err);
    return NextResponse.json({ error: "Failed to create job" }, { status: 500 });
  }
}
