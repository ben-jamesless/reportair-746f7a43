export type ProjectRole = "owner" | "editor" | "viewer";

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
  role === "owner" || role === "editor" || role === "viewer";

export const canLeaveProject = (role: ProjectRole | null | undefined) =>
  role === "editor" || role === "viewer";
