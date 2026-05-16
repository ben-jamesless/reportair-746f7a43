import { describe, it, expect } from "vitest";
import { PROJECT_COLOR_PALETTE, DEFAULT_PROJECT_COLOR } from "@/lib/projectColors";

describe("project colors", () => {
  it("default color is the first palette entry", () => {
    expect(DEFAULT_PROJECT_COLOR).toBe(PROJECT_COLOR_PALETTE[0]);
  });

  it("every palette entry is a 6-digit hex string", () => {
    for (const c of PROJECT_COLOR_PALETTE) {
      expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it("palette has no duplicates", () => {
    const set = new Set(PROJECT_COLOR_PALETTE.map((c) => c.toLowerCase()));
    expect(set.size).toBe(PROJECT_COLOR_PALETTE.length);
  });
});
