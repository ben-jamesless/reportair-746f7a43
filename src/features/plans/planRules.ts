/** Pure rules for the Plans feature, shared by the UI and tests. */

export const ACCEPTED_EXTS = ["pdf", "dwg", "dxf", "doc", "docx", "xls", "xlsx", "csv", "jpg", "jpeg", "png", "heic"] as const;
export const MAX_PLAN_BYTES = 200 * 1024 * 1024;

/** "New" badge on the Plans tab for the first release. Flip to false to remove. */
export const PLANS_SHOW_NEW_BADGE = true;

export const fileExt = (name: string) => {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
};

export function validatePlanFile(file: { name: string; size: number }): string | null {
  const ext = fileExt(file.name);
  if (!(ACCEPTED_EXTS as readonly string[]).includes(ext)) {
    return `${ext ? `.${ext}` : "This"} files aren't supported. Use PDF, DWG, DXF, Word, Excel, CSV, JPG, PNG or HEIC.`;
  }
  if (file.size > MAX_PLAN_BYTES) return "File is larger than 200 MB.";
  return null;
}

/**
 * Category pre-fill from file type only (never the file name).
 * Returns the default category name, or null to leave it for the user.
 */
export function prefillCategoryName(fileName: string): string | null {
  const ext = fileExt(fileName);
  if (ext === "dwg" || ext === "dxf") return "Site plans and CAD";
  if (["jpg", "jpeg", "png", "heic"].includes(ext)) return "Renders";
  if (["xls", "xlsx", "csv"].includes(ext)) return "Schedule and timeline";
  return null;
}

export const isToSort = (f: { category_id: string | null }) => f.category_id == null;

/** A file may be switched on for the client link only once it has been filed. */
export const canShareWithClient = (f: { category_id: string | null; deleted_at: string | null }) =>
  f.category_id != null && f.deleted_at == null;

export const RESTORE_WINDOW_DAYS = 30;
export const canStillRestore = (deletedAt: string, now = new Date()) =>
  now.getTime() - new Date(deletedAt).getTime() < RESTORE_WINDOW_DAYS * 86400000;

export function typeTile(ext: string | null | undefined, kind?: string) {
  if (kind === "link") return { label: "LINK", cls: "bg-[hsl(var(--plan-link))]" };
  const e = (ext ?? "").toLowerCase();
  if (e === "pdf") return { label: "PDF", cls: "bg-[hsl(var(--plan-pdf))]" };
  if (e === "dwg" || e === "dxf") return { label: e.toUpperCase(), cls: "bg-[hsl(var(--plan-cad))]" };
  if (e === "doc" || e === "docx") return { label: "DOCX", cls: "bg-[hsl(var(--plan-doc))]" };
  if (["xls", "xlsx", "csv"].includes(e)) return { label: e === "csv" ? "CSV" : "XLSX", cls: "bg-[hsl(var(--plan-sheet))]" };
  return { label: e === "jpeg" ? "JPG" : (e || "FILE").toUpperCase(), cls: "bg-[hsl(var(--plan-image))]" };
}

export const isPreviewableImage = (ext?: string | null) => ["jpg", "jpeg", "png"].includes((ext ?? "").toLowerCase());
export const isPdf = (ext?: string | null) => (ext ?? "").toLowerCase() === "pdf";

export function formatBytes(n?: number | null) {
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}
