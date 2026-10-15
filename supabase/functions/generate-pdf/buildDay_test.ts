import { buildDayNumber } from "./buildDay.ts";

Deno.test("build days include days without uploads", () => {
  for (const [date, expected] of [["2026-10-12", 1], ["2026-10-13", 2], ["2026-10-14", 3]] as const) {
    if (buildDayNumber(date, "2026-10-12") !== expected) throw new Error(`Wrong day for ${date}`);
  }
});
Deno.test("scheduled start, not first upload, anchors numbering", () => {
  if (buildDayNumber("2026-10-14", "2026-10-05") !== 10) throw new Error("Wrong scheduled day");
});
Deno.test("date-only counting survives DST and month boundaries", () => {
  if (buildDayNumber("2026-11-02", "2026-10-24") !== 10) throw new Error("Wrong elapsed days");
});
Deno.test("missing, invalid, and pre-build dates never default to Day 1", () => {
  for (const start of [null, "2026-10-15", "2026-02-30", "invalid"]) {
    if (buildDayNumber("2026-10-14", start) !== null) throw new Error("Invented build day");
  }
});