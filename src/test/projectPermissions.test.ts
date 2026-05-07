import { describe, it, expect } from "vitest";
import {
  canDeleteProject,
  canEditProject,
  canArchiveProject,
  canExportProject,
  canLeaveProject,
} from "@/lib/projectPermissions";

describe("project role gating", () => {
  it("owner: delete + edit + archive + export, no leave", () => {
    expect(canDeleteProject("owner")).toBe(true);
    expect(canEditProject("owner")).toBe(true);
    expect(canArchiveProject("owner")).toBe(true);
    expect(canExportProject("owner")).toBe(true);
    expect(canLeaveProject("owner")).toBe(false);
  });

  it("editor: edit + archive + export, no delete, can leave", () => {
    expect(canDeleteProject("editor")).toBe(false);
    expect(canEditProject("editor")).toBe(true);
    expect(canArchiveProject("editor")).toBe(true);
    expect(canExportProject("editor")).toBe(true);
    expect(canLeaveProject("editor")).toBe(true);
  });

  it("viewer: export + leave only, no delete/edit/archive", () => {
    expect(canDeleteProject("viewer")).toBe(false);
    expect(canEditProject("viewer")).toBe(false);
    expect(canArchiveProject("viewer")).toBe(false);
    expect(canExportProject("viewer")).toBe(true);
    expect(canLeaveProject("viewer")).toBe(true);
  });

  it("null role: nothing", () => {
    expect(canDeleteProject(null)).toBe(false);
    expect(canEditProject(null)).toBe(false);
    expect(canArchiveProject(null)).toBe(false);
    expect(canExportProject(null)).toBe(false);
    expect(canLeaveProject(null)).toBe(false);
  });
});
