# Beta membership verification

## Result
- Company owner invitation created through Team, accepted through its invitation URL, opened the assigned real event and read back as Accepted. Temporary self-invitation removed; existing memberships retained.
- Owner controls show Editor, Crew and Viewer; commercial classification is hidden in beta. Viewer comment capability and capture-only Crew restrictions are covered by permission regression tests.
- Billing redirects beta accounts to projects and subscription controls are absent in Settings.
- Real beta date-range portrait PDF generated and downloaded (4.3 MB); optional share expiry saved, read back, then restored. Client report opened signed out.
- Membership, permissions and beta limits tests passed; nine billing mapping/signature tests passed. Stripe price mappings and handlers remain in place; billing history is separate from beta entitlements.
- Inbox delivery is not verified: the configured sender domain has timed out awaiting verification. Email queuing is not proof of inbox delivery. Copy invitation links remains available.
- Fresh-account signup/confirmation and a distinct invitee's authenticated upload/comment actions remain unverified end-to-end; no unrelated user's session was minted. Existing signup-gate tests from the preceding beta-access task remain recorded separately.

## Applied schema inventory
- `drizzle/migrations/0001_beta_entitlements_and_company_invitations.sql`: beta entitlements, preserved billing state, company invitations, explicit project assignment and admin usage.
- `drizzle/migrations/0002_beta_membership_permission_boundaries.sql`: company/project permission boundaries.
- Existing `0000_invitation_only_beta_access.sql` retained.

## Application inventory
- `src/App.tsx`, `src/components/BetaCommercialGuard.tsx`, `src/components/AppSidebar.tsx`, `src/components/TrialBanner.tsx`, `src/components/PaymentFailedBanner.tsx`: routes and beta commercial visibility.
- `src/hooks/planLimits.ts`, `src/hooks/usePlan.ts`, `src/hooks/useAuth.tsx`, `src/lib/projectPermissions.ts`: entitlements, invite hydration and permissions.
- `src/pages/Settings.tsx`, `src/pages/Onboarding.tsx`, `src/pages/Team.tsx`, `src/pages/CompanyInviteAccept.tsx`, `src/features/members/CompanyInvites.tsx`, `src/components/InvitesManager.tsx`, `src/features/projectDetailV2/MembersPanel.tsx`: colleague/account flows.
- `src/pages/admin/AdminLayout.tsx`, `src/pages/admin/AdminBetaUsage.tsx`, `src/pages/admin/AdminEarlyAccess.tsx`, `src/components/marketing/EarlyAccessForm.tsx`: admin reporting, approval and requests.
- `src/components/ProjectSettingsDialog.tsx`, `src/features/projectDetailV2/SharePanel.tsx`: full beta branding access and optional share expiry.
- `src/pages/Unsubscribe.tsx`, `src/test/planLimits.test.ts`: email preference page and entitlement regressions.

## Deployed function inventory
- `generate-pdf`, `stripe-checkout`, `stripe-portal`, `stripe-sync-subscription`, `stripe-webhook`: beta allowances and preserved billing.
- `send-billing-email`: retained billing-email handler, called by Stripe webhook.
- `send-transactional-email`, `preview-transactional-email`, `_shared/transactional-email-templates/beta.tsx`, `_shared/transactional-email-templates/registry.ts`: registered app emails with actor verification and server-owned recipients/URLs.
- `handle-email-unsubscribe`, `handle-email-suppression`: scaffolded email preference helpers.

No frontend publishing action was performed. Backend changes and deployed functions are active on the shared backend.