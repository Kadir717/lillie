import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { JOB_STATUSES, JOB_PRIORITIES, type JobStatus, type JobPriority } from "@/lib/jobs/types";

/** Resolves the owning user's Prisma id, or null when not found. */
async function getUserId(session: Awaited<ReturnType<typeof getSession>>): Promise<string | null> {
  if (!session) return null;
  const user = await prisma.user.findUnique({
    where: { githubId: session.githubId },
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * GET /api/jobs/[id]
 *
 * Returns one tracked job, including the full cached match snapshot
 * (`matchJson`) for the detail view.
 *
 * Responses:
 *   200 — { job }
 *   401 — not authenticated
 *   404 — job not found or not owned
 *   500 — unexpected failure
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = await getUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const job = await prisma.job.findFirst({
      where: { id, userId },
    });
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      job: {
        ...job,
        appliedAt: job.appliedAt?.toISOString() ?? null,
        deadline: job.deadline?.toISOString() ?? null,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Failed to fetch job:", err);
    return NextResponse.json({ error: "Failed to load job" }, { status: 500 });
  }
}

/**
 * PATCH /api/jobs/[id]
 *
 * Updates job fields. All fields optional; only the owning user may update.
 *
 * Responses:
 *   200 — { job }
 *   400 — invalid field value / no valid fields
 *   401 — not authenticated
 *   404 — job not found or not owned
 *   500 — unexpected failure
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = await getUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Request body must be a JSON object" }, { status: 400 });
  }

  // ── Build validated updates ────────────────────────────────────
  // Typed as Prisma's update input so every assigned field is checked
  // against the schema at compile time (a plain Record<string, ...> would
  // silently accept wrong shapes).
  const updates: Prisma.JobUncheckedUpdateInput = {};

  if (body.company !== undefined) {
    const company = typeof body.company === "string" ? body.company.trim() : "";
    if (!company || company.length > 120) {
      return NextResponse.json(
        { error: "Company must be 1-120 characters" },
        { status: 400 }
      );
    }
    updates.company = company;
  }

  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim() : "";
    if (!title || title.length > 120) {
      return NextResponse.json(
        { error: "Title must be 1-120 characters" },
        { status: 400 }
      );
    }
    updates.title = title;
  }

  if (body.url !== undefined) {
    updates.url = typeof body.url === "string" ? body.url.trim().slice(0, 500) : null;
  }

  if (body.description !== undefined) {
    updates.description =
      typeof body.description === "string" ? body.description.trim().slice(0, 20_000) : null;
  }

  if (body.notes !== undefined) {
    updates.notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : null;
  }

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !JOB_STATUSES.includes(body.status as JobStatus)) {
      return NextResponse.json(
        { error: `Invalid status. Supported: ${JOB_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.status = body.status as JobStatus;
  }

  if (body.priority !== undefined) {
    if (typeof body.priority !== "string" || !JOB_PRIORITIES.includes(body.priority as JobPriority)) {
      return NextResponse.json(
        { error: `Invalid priority. Supported: ${JOB_PRIORITIES.join(", ")}` },
        { status: 400 }
      );
    }
    updates.priority = body.priority as JobPriority;
  }

  // Optional dates: absent = untouched, null = clear, valid string = set,
  // anything else (including invalid date strings) = 400.
  type DateFieldResult = { kind: "skip" | "clear" | "set"; value: Date | null };
  const parseDateField = (v: unknown): DateFieldResult => {
    if (v === undefined) return { kind: "skip", value: null };
    if (v === null) return { kind: "clear", value: null };
    if (typeof v !== "string") return { kind: "skip", value: null }; // treated as invalid below
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return { kind: "skip", value: null }; // invalid date string
    return { kind: "set", value: d };
  };

  const applyDateField = (key: string, field: "appliedAt" | "deadline"): boolean => {
    const result = parseDateField(body[key]);
    if (result.kind === "skip" && body[key] !== undefined) {
      // Present but not a valid date string — reject.
      return false;
    }
    if (result.kind === "set" || result.kind === "clear") {
      updates[field] = result.value;
    }
    return true;
  };

  if (!applyDateField("appliedAt", "appliedAt")) {
    return NextResponse.json(
      { error: "appliedAt must be a valid date string or null" },
      { status: 400 }
    );
  }
  if (!applyDateField("deadline", "deadline")) {
    return NextResponse.json(
      { error: "deadline must be a valid date string or null" },
      { status: 400 }
    );
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      { error: "No valid fields to update" },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.job.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const job = await prisma.job.update({
      where: { id },
      data: updates,
    });

    return NextResponse.json({
      job: {
        ...job,
        appliedAt: job.appliedAt?.toISOString() ?? null,
        deadline: job.deadline?.toISOString() ?? null,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Failed to update job:", err);
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}

/**
 * DELETE /api/jobs/[id]
 *
 * Deletes a tracked job. Only the owning user may delete.
 *
 * Responses:
 *   200 — { success: true }
 *   401 — not authenticated
 *   404 — job not found or not owned
 *   500 — unexpected failure
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = await getUserId(session);
  if (!userId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { id } = await params;

  try {
    const existing = await prisma.job.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    await prisma.job.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Failed to delete job:", err);
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 });
  }
}
