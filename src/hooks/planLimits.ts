// Single source of truth for plan tiers, limits, and normalisation.
// Both usePlan (account-scoped) and useProjectPlan (project-scoped) import from here.

export type PlanName = "free" | "solo" | "pro" | "studio";

export interface PlanLimits {
  maxProjects:            number;   // -1 = unlimited
  maxMembers:             number;   // -1 = unlimited
  maxUpdateDays:          number;   // max distinct photo-upload dates per project; -1 = unlimited
  maxExportsMonth:        number;   // -1 = unlimited
  pdfExport:              boolean;
  shareLinks:             boolean;
  shareLinkEmail:         boolean;
  passwordLinks:          boolean;
  showBuildSlidesBranding:boolean;
  allowCustomLogo:        boolean;
  whiteLabelFull:         boolean;
  projectFolders:         boolean;
  planIncludesInvites:    boolean;
}

export const LIMITS: Record<PlanName, PlanLimits> = {
  free: {
    maxProjects:             1,
    maxMembers:              1,
    maxUpdateDays:           3,
    maxExportsMonth:         0,
    pdfExport:               false,
    shareLinks:              true,
    shareLinkEmail:          false,
    passwordLinks:           false,
    showBuildSlidesBranding: true,
    allowCustomLogo:         false,
    whiteLabelFull:          false,
    projectFolders:          false,
    planIncludesInvites:     false,
  },
  solo: {
    maxProjects:             1,
    maxMembers:              1,
    maxUpdateDays:           -1,
    maxExportsMonth:         -1,
    pdfExport:               false,
    shareLinks:              true,
    shareLinkEmail:          false,
    passwordLinks:           false,
    showBuildSlidesBranding: true,
    allowCustomLogo:         false,
    whiteLabelFull:          false,
    projectFolders:          false,
    planIncludesInvites:     false,
  },
  pro: {
    maxProjects:             5,
    maxMembers:              5,
    maxUpdateDays:           -1,
    maxExportsMonth:         -1,
    pdfExport:               true,
    shareLinks:              true,
    shareLinkEmail:          true,
    passwordLinks:           true,
    showBuildSlidesBranding: true,
    allowCustomLogo:         true,
    whiteLabelFull:          false,
    projectFolders:          true,
    planIncludesInvites:     true,
  },
  studio: {
    maxProjects:             -1,
    maxMembers:              -1,
    maxUpdateDays:           -1,
    maxExportsMonth:         -1,
    pdfExport:               true,
    shareLinks:              true,
    shareLinkEmail:          true,
    passwordLinks:           true,
    showBuildSlidesBranding: false,
    allowCustomLogo:         true,
    whiteLabelFull:          true,
    projectFolders:          true,
    planIncludesInvites:     true,
  },
};

// "free" now stays as "free" — it is a real plan, not a fallback.
export function normalisePlan(raw: string | null | undefined): PlanName {
  switch (raw) {
    case "free":       return "free";
    case "solo":       return "solo";
    case "pro":        return "pro";
    case "team":       return "pro";
    case "studio":     return "studio";
    case "enterprise": return "studio";
    default:           return "free";
  }
}
