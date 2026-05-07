import { describe, expect, it } from "vitest";
import { isProjectInFolderView } from "@/lib/accessibleProjects";

const FOLDER_ALL = "__all__";
const FOLDER_UNFOLDERED = "__unfoldered__";

describe("project folder visibility", () => {
  it("shows direct-member projects in All Projects regardless of folder ownership", () => {
    const invitedProject = { folder_id: "owner-folder" };

    expect(isProjectInFolderView(invitedProject, FOLDER_ALL, new Set<string>(), FOLDER_ALL, FOLDER_UNFOLDERED)).toBe(true);
  });

  it("treats projects in folders the user cannot see as uncategorised", () => {
    const invitedProject = { folder_id: "owner-folder" };

    expect(isProjectInFolderView(invitedProject, FOLDER_UNFOLDERED, new Set<string>(), FOLDER_ALL, FOLDER_UNFOLDERED)).toBe(true);
  });

  it("does not show projects from visible folders in Uncategorised", () => {
    const ownFolderProject = { folder_id: "my-folder" };

    expect(
      isProjectInFolderView(ownFolderProject, FOLDER_UNFOLDERED, new Set(["my-folder"]), FOLDER_ALL, FOLDER_UNFOLDERED),
    ).toBe(false);
  });
});