// Single source of truth for plan tiers, limits, and normalisation.
// Both usePlan (account-scoped) and useProjectPlan (project-scoped) import from here.

export type PlanName = "free" | "solo" | "crew" | "studio";

export interface PlanLimits {
  maxProjects:            number;   // -1 = unlimited
  maxMembers:             number;   // -1 = unlimited (core seats; externals gated separately)
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
  allowsExternals:        boolean;  // Crew/Studio only
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
    allowsExternals:         false,
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
    allowsExternals:         false,
  },
  crew: {
    maxProjects:             5,
    maxMembers:              5, // base core seats; add-on seats extend up to 10
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
    allowsExternals:         true,
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
    allowsExternals:         true,
  },
};

// TODO(post-migration, 2026-Q3): remove legacy plan-name normalisation.
// These branches exist ONLY as scaffolding until the DB backfill of legacy
// values (`pro`, `team`, `enterprise`) → (`crew`, `crew`, `studio`) is complete
// and Stripe metadata has been re-issued against the new price IDs. Keeping
// them longer than that risks silently establishing a second source of truth.
// Delete this function's legacy branches (leave only free/solo/crew/studio)
// once B6 backfill is verified and Stripe archive of old Prices is confirmed.
export function normalisePlan(raw: string | null | undefined): PlanName {
  switch (raw) {
    case "free":       return "free";
    case "solo":       return "solo";
    case "crew":       return "crew";
    case "pro":        return "crew";       // legacy — remove post-migration
    case "team":       return "crew";       // legacy — remove post-migration
    case "studio":     return "studio";
    case "enterprise": return "studio";     // legacy — remove post-migration
    default:           return "free";
  }
}

