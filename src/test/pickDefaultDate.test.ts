import { describe, it, expect } from "vitest";
import { pickDefaultDate } from "@/features/sharePageV2/pickDefaultDate";

const T = "2026-10-19";
describe("pickDefaultDate", () => {
  it("falls back to latest earlier active day when today is empty", () => {
    expect(
      pickDefaultDate(
        [
          { date: "2026-10-16", photo_count: 4 },
          { date: "2026-10-18", photo_count: 12 },
          { date: T, photo_count: 0 },
        ],
        T,
      ),
    ).toEqual({ date: "2026-10-18", isFallback: true });
  });
  it("opens today when today has photos", () => {
    expect(pickDefaultDate([{ date: "2026-10-18", photo_count: 3 }, { date: T, photo_count: 1 }], T)).toEqual({
      date: T,
      isFallback: false,
    });
  });
  it("stays on today when nothing was ever recorded", () => {
    expect(pickDefaultDate([{ date: T, photo_count: 0 }], T)).toEqual({ date: T, isFallback: false });
  });
});
