import { describe, it, expect } from "vitest";
import { projectStatusMeta, PROJECT_STATUSES } from "@/lib/projectStatus";

describe("projectStatusMeta", () => {
  it("returns the canonical meta for each known status", () => {
    for (const s of PROJECT_STATUSES) {
      expect(projectStatusMeta(s.value).value).toBe(s.value);
    }
  });

  it("maps legacy behind_schedule to the red Delayed style without losing the value", () => {
    const meta = projectStatusMeta("behind_schedule");
    expect(meta.value).toBe("behind_schedule");
    expect(meta.label).toBe("Delayed");
    expect(meta.dotClass).toContain("C7382A");
  });

  it("falls back to not_started for null / undefined / unknown values", () => {
    expect(projectStatusMeta(null).value).toBe("not_started");
    expect(projectStatusMeta(undefined).value).toBe("not_started");
    // Unknown string: still safe
    // @ts-expect-error -- testing fallback for stray DB values
    expect(projectStatusMeta("nonsense").value).toBe("not_started");
  });
});
