import { describe, it, expect } from "vitest";
import { getPlan, isPlanUsable, isValidPlanId, PLANS } from "./plans";

describe("PLANS catalog", () => {
  it("defines free/pro/premium", () => {
    expect(Object.keys(PLANS).sort()).toEqual(["free", "premium", "pro"]);
  });

  it("free has the lowest limits", () => {
    expect(PLANS.free.maxProfiles).toBeLessThan(PLANS.pro.maxProfiles);
    expect(PLANS.free.maxJobs).toBeLessThan(PLANS.pro.maxJobs);
    expect(PLANS.free.maxMonthlyExports).toBeLessThan(PLANS.pro.maxMonthlyExports);
  });

  it("free has no premium templates and no AI credits", () => {
    expect(PLANS.free.premiumTemplates).toBe(false);
    expect(PLANS.free.aiCreditsPerMonth).toBe(0);
  });
});

describe("getPlan", () => {
  it("resolves known plan ids", () => {
    expect(getPlan("free").id).toBe("free");
    expect(getPlan("pro").id).toBe("pro");
    expect(getPlan("premium").id).toBe("premium");
  });

  it("falls back to free for unknown/null values", () => {
    expect(getPlan("hacker").id).toBe("free");
    expect(getPlan(null).id).toBe("free");
    expect(getPlan(undefined).id).toBe("free");
    expect(getPlan("").id).toBe("free");
  });
});

describe("isValidPlanId", () => {
  it("accepts only real plan ids", () => {
    expect(isValidPlanId("free")).toBe(true);
    expect(isValidPlanId("pro")).toBe(true);
    expect(isValidPlanId("premium")).toBe(true);
    expect(isValidPlanId("admin")).toBe(false);
    expect(isValidPlanId(null)).toBe(false);
    expect(isValidPlanId(undefined)).toBe(false);
  });
});

describe("isPlanUsable", () => {
  it("grants access for active/trialing/past_due", () => {
    expect(isPlanUsable("active")).toBe(true);
    expect(isPlanUsable("trialing")).toBe(true);
    expect(isPlanUsable("past_due")).toBe(true);
  });

  it("denies canceled/none", () => {
    expect(isPlanUsable("canceled")).toBe(false);
    expect(isPlanUsable("none")).toBe(false);
  });
});
