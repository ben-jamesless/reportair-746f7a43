import { describe, expect, it } from "vitest";
import { LIMITS, normalisePlan } from "@/hooks/planLimits";
describe("beta entitlements", () => {
  it("has unlimited commercial caps without reintroducing password UI", () => {
    for (const key of ["maxProjects", "maxMembers", "maxUpdateDays", "maxExportsMonth"] as const) expect(LIMITS.beta[key]).toBe(-1);
    for (const key of ["pdfExport", "shareLinks", "shareLinkEmail", "allowCustomLogo", "whiteLabelFull", "projectFolders", "planIncludesInvites", "allowsExternals"] as const) expect(LIMITS.beta[key]).toBe(true);
    expect(LIMITS.beta.passwordLinks).toBe(false);
    expect(LIMITS.beta.showBuildSlidesBranding).toBe(false);
  });
  it("retains the paid-tier limits", () => {
    expect(LIMITS.solo.maxProjects).toBe(1);
    expect(LIMITS.crew.maxProjects).toBe(5);
    expect(LIMITS.crew.maxMembers).toBe(5);
    expect(LIMITS.studio.maxProjects).toBe(-1);
  });
  it("accepts only current stored plans", () => {
    expect(normalisePlan("beta")).toBe("beta");
    expect(normalisePlan("crew")).toBe("crew");
    expect(normalisePlan("pro")).toBe("free");
  });
});