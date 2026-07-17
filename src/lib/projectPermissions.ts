export type ProjectRole = "owner" | "editor" | "viewer" | "commenter" | "crew";

/**
 * Source of truth for project-level UI gating.
 * Mirrors the `has_project_role` RLS helper in the database.
 *
 * `crew` is capture-only: upload photos + write area notes. Explicitly
 * excluded from every other capability (no read of report content, no
 * edit/delete/share/export).
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
  role === "editor" || role === "viewer" || role === "commenter" || role === "crew";

export const canUploadPhotos = (role: ProjectRole | null | undefined) =>
  role === "owner" || role === "editor" || role === "crew";

/** Crew has no access to reports, map, library, sharing, or settings. */
export const isCrewOnly = (role: ProjectRole | null | undefined) => role === "crew";
