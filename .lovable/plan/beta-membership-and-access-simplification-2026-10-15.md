# Beta membership and access simplification

## Direction
Give approved companies full product access during beta, with unlimited projects and colleagues and no pricing, trial or upgrade screens. Keep request-only signup, company separation, project permissions, existing paid tiers and Stripe integration intact.

Your agreed adjustments:
- Keep colleague invitations and ownership controls owner-only. Editors manage event content; Crew retains capture-only access; Viewers read and comment.
- Keep share-link views deferred with the future analytics platform.
- Send new access-request alerts to one shared admin inbox, not a list of administrators.

## Verified comparison with the brief
- The live signup gate currently accepts approved early-access requests or pending project invites; a separate company invitation system needs adding.
- Teams are created during onboarding. The signup trigger creates the user profile and basic user role, not the company. Set the new-team default at company creation and skip the plan-selection step.
- The database currently contains two Free teams and one Studio team. No current team has a legacy plan name. Preserve each team's previous plan before moving it to Beta.
- One team has a linked Stripe subscription record marked trialing with a May 2026 end date. Its current Stripe status and potential charges require verification; the database record alone is not sufficient.
- Stripe webhook code currently replaces team plans on subscription updates and cancellation. Beta access needs protection from those updates while billing records continue to synchronise.
- The interface allows Viewers and Commenters to comment, but the live internal-photo-comment insertion policy currently permits only Owners and Editors. Correct both layers together.
- Early-access approval currently offers a manual email link. It does not automatically send a Create account email.
- The configured Lovable sender domain failed verification. Existing invitation and welcome functions use a separate sending service. Reliable delivery is unverified.
- Share links use generated random UUID tokens and store revocation and expiry dates. Validate enforcement across all share resources and add an expiry control to the current sharing panel.

## Proposed implementation

### 1. Full beta access without losing billing history
- Add the Beta tier with unlimited commercial quotas, PDF exports, custom logos, folders and full white-label capability. Keep the existing tiers.
- Add protected previous-plan and billing-entitlement tracking so leaving beta later does not lose the company's paid entitlement.
- Add `beta_joined_at` and `founding_member` (default true) to teams. Record the actual conversion timestamp for existing teams; do not invent historical beta dates.
- Make newly created approved-company teams Beta. Convert existing teams after preserving their previous plan; use a data update rather than a data-only migration.
- Update frontend, database seat enforcement and export/branding checks. Bypass commercial caps, domain-classification prompts and external-approval requirements for Beta only.
- Keep authentication, suspension, company/project permissions, file validation and report-size safety limits in place.
- Protect Beta from Stripe plan overwrites, retain subscription synchronisation, and reject new beta checkout attempts on the server. Do not cancel or alter real subscriptions without separate authorisation.
- Keep legacy compatibility until stored values, Stripe price mappings and incoming metadata are verified. Remove obsolete aliases only after that evidence supports doing so.

### 2. Remove commercial screens from the beta experience
- Hide plan names, badges, pricing navigation, upgrade prompts, commercial limit warnings, trial/payment banners and billing settings for Beta.
- Redirect direct billing, checkout and onboarding-plan visits safely to projects. Preserve their non-beta paths for future use.
- Retain branding controls without Studio-only wording and ensure project access uses the owning company's entitlement, including for invited colleagues.
- Keep public Coming soon / Request early access pages and the signup gate.

### 3. Simple membership and colleague invitations
- Display colleagues as Member without Core/External categories, seat counters or ratio warnings. Preserve existing membership fields and roles.
- Offer Editor, Crew and Viewer in project role controls. Display existing Commenters as Viewer and safely align their permissions without deleting enum values. Owners stay implied and cannot be demoted through these controls.
- Add one owner-only Invite colleague flow: email, selected projects and one project role, then Send.
- Store a company invitation with selected-project assignments, random token, pending/accepted/cancelled status, expiry and delivery status.
- Acceptance verifies the signed-in email and active invitation, adds team and selected-project memberships together, and handles retries safely. Never grant projects outside the inviting company or escalate company roles.
- Accept valid company invites in the beta signup gate alongside existing project invites. Complete acceptance after profile creation and avoid sending colleagues through company-creation onboarding.
- Support pending/accepted listings, resend, cancel, expired/wrong-email handling and existing-account acceptance. Cancelled or expired invites must not permit signup or later acceptance.

### 4. Access requests and dependable emails
- Keep requests separate from marketing subscriptions and approval restricted to platform admins.
- On a genuinely new request, send one event-specific alert to the agreed shared admin address. Duplicate form submissions must not create duplicate alerts.
- Approval automatically sends a branded Create account email to that requester, with visible send/failure status and a safe retry. Do not label approval as delivered when only the approval saved.
- Resolve the configured email-domain verification, establish supported Lovable app-email templates and retain working existing email behaviour during the transition.
- Use event-derived idempotency, normal suppression handling and the required unsubscribe page/footer. Update the beta welcome email to remove plan/upgrade messaging.
- Verify sender authentication and actual receipt with controlled recipients. Provider acceptance is not proof of inbox delivery, and spam-free delivery cannot be guaranteed.

### 5. Sharing and admin-only beta tracking
- Add optional share expiry without restoring passwords or view counters.
- Verify revoked/expired links fail for the main report, photo URLs, maps, comments, logos and export requests.
- Add admin-only company usage columns: project count, member count, recorded update days and completed PDF exports, plus beta entry and founding-member flag.
- Define recorded update days as distinct project/local-date pairs with non-reference photos; completed exports as ready export records. Label totals consistently and avoid unreliable monthly/view counters.
- Keep analytics explicitly deferred in the roadmap.

## Technical change inventory
No source, schema, data or deployed functions have been changed during this review. Before implementation, confirm the inventory against a repository-wide gate search; before deployment, provide the final exact list, including generated migration filenames and tests.

### Existing application files expected to change
- `src/hooks/planLimits.ts`, `src/hooks/usePlan.ts`, `src/hooks/useProjectPlan.ts`, `src/hooks/useTeamSeatSummary.ts`
- `src/lib/projectPermissions.ts`, `src/hooks/useProjectMembers.ts`
- `src/App.tsx`, `src/components/PlanGuard.tsx`, `src/components/AppSidebar.tsx`, `src/components/AppShell.tsx`
- `src/components/TrialBanner.tsx`, `src/components/PaymentFailedBanner.tsx`, `src/components/UpgradeDialog.tsx`, `src/components/FreePlanUploadGate.tsx`
- `src/pages/Onboarding.tsx`, `src/pages/Plan.tsx`, `src/pages/Auth.tsx`, `src/pages/InviteAccept.tsx`, `src/pages/Team.tsx`, `src/pages/Settings.tsx`, `src/pages/Billing.tsx`, `src/pages/Projects.tsx`
- `src/components/InvitesManager.tsx`, `src/features/projectDetailV2/MembersPanel.tsx`, `src/features/projectDetailV2/TeamSeatStrip.tsx`, `src/features/projectDetailV2/ApprovalsInbox.tsx`, `src/features/projectDetailV2/UnclassifiedMembersPanel.tsx`
- `src/components/ProjectEditForm.tsx`, `src/components/ExportPdfDialog.tsx`, `src/features/projectDetailV2/SharePanel.tsx`
- `src/components/marketing/EarlyAccessForm.tsx`, `src/pages/admin/AdminEarlyAccess.tsx`, `src/pages/admin/AdminUsers.tsx`, `src/components/admin/AccountPreviewDialog.tsx`
- `AGENTS.md`, `roadmap.md`; save the agreed beta requirements to project memory during implementation.

### Existing functions expected to change
- `supabase/functions/stripe-webhook/index.ts`, `supabase/functions/stripe-webhook/helpers.ts`, `supabase/functions/stripe-sync-subscription/index.ts`, `supabase/functions/stripe-checkout/index.ts`, `supabase/functions/stripe-portal/index.ts`
- `supabase/functions/generate-pdf/index.ts`, `supabase/functions/share-create-export/index.ts`
- `supabase/functions/send-invite-email/index.ts`, `supabase/functions/send-transactional-email/index.ts`

### New focused modules
- Shared beta/billing-entitlement helpers and a company-invite service/UI used by Team and project Members.
- Company-invitation acceptance and early-access email dispatch functions with server-side authority checks.
- Branded app-email templates/registry and the unsubscribe page required by the supported email setup.
- Focused unit and end-to-end tests for beta gates, invitation acceptance/cancellation, role permissions, Stripe preservation and exports. Email setup tools may create their managed files; include these in the final inventory.

### Schema changes through Lovable Cloud migrations
1. Beta team metadata, preserved billing entitlement, defaults and protected commercial enforcement helpers.
2. Company invites and selected-project assignments; explicit grants, RLS, owner-only management, secure acceptance and signup eligibility functions.
3. Viewer/legacy Commenter comment permissions, beta seat behaviour and admin-only usage reporting.
4. Event-specific email dispatch/delivery tracking if required by the chosen supported email scaffold.

Existing tables, enum values, plan tiers and Stripe records remain. Treat existing-team conversion and any legacy data cleanup as separate controlled data updates, not data-only migrations. Use only the supported email setup tools for managed email infrastructure.

## Verification before deployment
- Exercise the full requested flow with real test accounts: request → admin approval/email → approved signup → company/project creation → colleague invite/email → colleague signup without admin approval → automatic membership → Crew update → owner PDF download → public client report.
- Read back memberships, roles, update and export records through the UI; visually inspect the downloaded portrait PDF.
- Test Viewer comments and Crew restrictions, owner-only invites, company isolation, duplicate acceptance, wrong email, cancellation, expiry and unapproved signup denial.
- Test all beta commercial gates, direct billing URLs and backend checkout denial, while preserving report safety limits.
- Run paid-tier regression tests and signed Stripe-event tests showing normal paid behaviour and beta entitlement preservation. Verify actual Stripe configuration separately; do not claim paid billing is proven from source inspection alone.
- Check email receipt and sender authentication; report any user action needed for domain verification or mailbox confirmation.
- Produce the exact changed-file/migration inventory and a rollback/exit-beta procedure. Publishing requires your explicit go-ahead.

## Outstanding inputs and external checks
- The shared admin inbox address is still needed; no address will be invented.
- Sender-domain verification and controlled inbox receipt must be resolved before claiming the email flow complete.
- Verify the linked subscription with Stripe before deciding whether a billing action is necessary; no charge, cancellation or pause is authorised by this plan.