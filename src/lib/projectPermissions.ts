export type ProjectRole = "owner" | "editor" | "viewer" | "commenter";

/**
 * Source of truth for project-level UI gating.
 * Mirrors the `has_project_role` RLS helper in the database.
 */
export const canDeleteProject = (role: ProjectRole | null | undefined) =>
  role === "owner";

export const canEditProject = (role: ProjectRole | null | undefined) =>
  role === "owner" || role === "editor";

export const canArchiveProject = (role: ProjectRole | null | undefined) =>
  role === "owner" || role === "editor";

export const canMoveProjectToFolder = (role: ProjectRole | null | undefined) =>
  role === "owner";

export const canExportProject = (role: ProjectRole | null | undefined) =>
  role === "owner" || role === "editor" || role === "viewer" || role === "commenter";

export const canCommentProject = (role: ProjectRole | null | undefined) =>
  role === "owner" || role === "editor" || role === "viewer" || role === "commenter";

export const canLeaveProject = (role: ProjectRole | null | undefined) =>
  role === "editor" || role === "viewer" || role === "commenter";
