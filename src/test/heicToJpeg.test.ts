import { describe, it, expect } from "vitest";
import { isHeicFile } from "@/lib/heicToJpeg";

const makeFile = (name: string, type = "") =>
  new File([new Uint8Array([0])], name, { type });

describe("isHeicFile", () => {
  it("detects by MIME type (heic/heif, case-insensitive)", () => {
    expect(isHeicFile(makeFile("a.jpg", "image/heic"))).toBe(true);
    expect(isHeicFile(makeFile("a.jpg", "IMAGE/HEIF"))).toBe(true);
  });

  it("detects by .heic / .heif extension when MIME is empty", () => {
    expect(isHeicFile(makeFile("photo.heic"))).toBe(true);
    expect(isHeicFile(makeFile("photo.HEIF"))).toBe(true);
  });

  it("returns false for regular images", () => {
    expect(isHeicFile(makeFile("photo.jpg", "image/jpeg"))).toBe(false);
    expect(isHeicFile(makeFile("photo.png", "image/png"))).toBe(false);
    expect(isHeicFile(makeFile("photo.webp", "image/webp"))).toBe(false);
  });

  it("does not match strings containing 'heic' that are not the extension", () => {
    expect(isHeicFile(makeFile("heic-summary.txt", "text/plain"))).toBe(false);
  });
});
