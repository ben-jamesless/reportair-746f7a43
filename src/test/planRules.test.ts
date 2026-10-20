import { describe, it, expect } from "vitest";
import { prefillCategoryName, validatePlanFile, isToSort, canShareWithClient, canStillRestore } from "@/features/plans/planRules";

describe("plan rules", () => {
  it("pre-fills CAD for DWG/DXF", () => {
    expect(prefillCategoryName("layout.DWG")).toBe("Site plans and CAD");
    expect(prefillCategoryName("x.dxf")).toBe("Site plans and CAD");
  });
  it("pre-fills Renders for images and Schedule for spreadsheets", () => {
    expect(prefillCategoryName("a.png")).toBe("Renders");
    expect(prefillCategoryName("a.xlsx")).toBe("Schedule and timeline");
  });
  it("leaves PDF and Word blank, ignoring the file name", () => {
    expect(prefillCategoryName("render site plan.pdf")).toBeNull();
    expect(prefillCategoryName("schedule.docx")).toBeNull();
  });
  it("rejects unsupported types", () => {
    expect(validatePlanFile({ name: "a.zip", size: 10 })).not.toBeNull();
    expect(validatePlanFile({ name: "a.pdf", size: 10 })).toBeNull();
  });
  it("treats files with no category as To sort and never client-shareable", () => {
    expect(isToSort({ category_id: null })).toBe(true);
    expect(canShareWithClient({ category_id: null, deleted_at: null })).toBe(false);
    expect(canShareWithClient({ category_id: "c", deleted_at: null })).toBe(true);
  });
  it("allows restore within 30 days only", () => {
    const now = new Date("2026-10-31T00:00:00Z");
    expect(canStillRestore("2026-10-05T00:00:00Z", now)).toBe(true);
    expect(canStillRestore("2026-09-20T00:00:00Z", now)).toBe(false);
  });
});
