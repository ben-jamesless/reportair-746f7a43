# Simplify the platform admin

## What's wrong today
- Six tabs overlap: the company list, Summary, Users and Projects all show the same people and events in different ways.
- Summary is built around paid billing (MRR, churn, active accounts). During the beta these all read zero.
- Users shows things that aren't true during the beta: every member says "Trial · 0d left" and "Card on file", and a whole "MRR" column is just dashes. Each row has 4 buttons.
- Projects has four columns that are always empty (Type, Phase, Location, Last activity).
- Signups (the old free-PDF list) has nothing to do with managing accounts any more.

## Proposed: three tabs

```text
Requests | Companies | People
```

1. **Requests** (opens first)
   - Early-access requests, with pending ones at the top and a count on the tab.
   - Same Approve / Decline / Resend invitation buttons as now.
   - The old PDF signup list moves to a small "Marketing signups" link at the bottom, with CSV export kept.

2. **Companies** (replaces Beta companies, Summary and Projects)
   - A short line of totals at the top: companies, people, events, photos.
   - One row per company: name, owner, joined date, events, people, PDFs.
   - Click a row to open it: its events (with Open and Archive/Unarchive) and its people with their real role (Owner or Member).

3. **People** (simplified Users)
   - Columns: name/email, company, role, joined, last active, status (Active / Suspended / No company).
   - Trial, card and MRR columns removed while in beta.
   - One "..." menu per row holding Send reset, View company, Suspend and Delete. Delete still asks for confirmation.

## Kept as-is
- Who can open the admin area, and the separate admin account.
- All approval, suspend, delete and archive behaviour.
- Billing records stay saved behind the scenes, and the billing totals can come back once paid plans go live.
- Old admin links redirect to the new tabs.

## Technical details
- `AdminLayout` tabs become `/admin/requests`, `/admin/companies`, `/admin/people`. Old routes (`/admin/beta`, `/summary`, `/users`, `/projects`, `/signups`, `/early-access`) redirect to them.
- Companies reuses the `admin_beta_usage`, `admin_list_projects` and `admin_list_team_members` lookups. The current preview dialog becomes an expandable company panel. The roles show the real team role (owner/admin/member) rather than a fixed "Member".
- People reuses `admin_list_users_with_accounts`. Billing-status rendering is dropped in the UI only.
- `AdminSummary`, `AdminProjects` and `AdminBetaUsage` are merged and then removed. `AdminLeadMagnet` is kept as a sub-view under Requests.
- No database changes.
