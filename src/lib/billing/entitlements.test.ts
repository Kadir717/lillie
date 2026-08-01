import { describe, it, expect, vi } from "vitest";

// entitlements.ts imports { prisma } from "../db" at top level, which would
// instantiate PrismaClient (resolving DATABASE_URL from env) just to test a
// PURE function. Mock it so the test is hermetic — no DB, no env required.
vi.mock("../db", () => ({ prisma: {} }));

import { resolveEntitlements, isAdmin } from "./entitlements";
import type { EntitlementUserRow } from "./entitlements";

function row(over: Partial<EntitlementUserRow> = {}): EntitlementUserRow {
  return {
    plan: "free",
    planStatus: "none",
    planExpiresAt: null,
    role: "user",
    ...over,
  };
}

describe("resolveEntitlements", () => {
  it("resolves a free plan to free limits", () => {
    const e = resolveEntitlements(row());
    expect(e.planId).toBe("free");
    expect(e.active).toBe(false);
    expect(e.maxProfiles).toBe(3);
  });

  it("resolves an active pro plan to pro limits", () => {
    const e = resolveEntitlements(
      row({ plan: "pro", planStatus: "active" })
    );
    expect(e.planId).toBe("pro");
    expect(e.active).toBe(true);
    expect(e.maxProfiles).toBe(20);
    expect(e.premiumTemplates).toBe(true);
  });

  it("falls back to free when the plan string is malformed", () => {
    const e = resolveEntitlements(
      row({ plan: "hacker", planStatus: "active" })
    );
    expect(e.planId).toBe("free");
    expect(e.active).toBe(false);
  });

  it("falls back to free when the plan expired", () => {
    const e = resolveEntitlements(
      row({
        plan: "premium",
        planStatus: "active",
        planExpiresAt: new Date(Date.now() - 1000),
      })
    );
    expect(e.planId).toBe("free");
    expect(e.active).toBe(false);
  });

  it("keeps paid access while not expired", () => {
    const e = resolveEntitlements(
      row({
        plan: "premium",
        planStatus: "active",
        planExpiresAt: new Date(Date.now() + 86_400_000),
      })
    );
    expect(e.planId).toBe("premium");
    expect(e.active).toBe(true);
  });

  it("treats canceled as free", () => {
    const e = resolveEntitlements(row({ plan: "pro", planStatus: "canceled" }));
    expect(e.planId).toBe("free");
    expect(e.active).toBe(false);
  });
});

describe("isAdmin", () => {
  it("recognizes the admin role", () => {
    expect(isAdmin(row({ role: "admin" }))).toBe(true);
    expect(isAdmin(row({ role: "user" }))).toBe(false);
  });
});
