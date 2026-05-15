
## Step 1 — Fix `src/pages/ProjectDetail.tsx` build errors (surgical)

Currently broken: undefined `setEditingProject`, `setProjectArchived`, `ShareButton`, `TabBar`; orphan `</Tabs>`; missing dropdown imports; `ProjectSettingsDialog` never rendered.

Edits to `src/pages/ProjectDetail.tsx`:

1. **Imports**: add `DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger` from `@/components/ui/dropdown-menu`, and `MoreVertical, Pencil, Lock` from `lucide-react` (merge into existing lucide import).
2. **State**: add `const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);` near `shareSettingsOpen`.
3. **Archive handler**: add `archiveProject` async function next to `restoreProject` that updates `archived_at` to now and reloads.
4. **Replace dropdown calls**:
   - `setEditingProject(project)` → `setSettingsDialogOpen(true)`
   - `setProjectArchived(project, true)` → `archiveProject`
5. **Inline components at module scope** (above `const ProjectDetail`): define `ShareButton({ projectId, canUseShareLink })` and `TabBar({ tabs, activeTab, onChange })` per spec. Use `Crown`, `Share2`, `Lock`, `Link`, `cn` (already imported / will be).
6. **Wrap tabs**: change the `<div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">` (line ~921) to `<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "photos" | "activity" | "details")} className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8">` and remove its matching `</div>` (the `</Tabs>` at line 1547 already closes it).
7. **Render `ProjectSettingsDialog`** before `</AppShell>` in controlled mode (`open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}`, `trigger={null}`). Add a `useEffect` listener for `"open-share-settings"` that calls `setShareSettingsOpen(true)`.

Verify zero TS errors after edit.

## Step 2 — Onboarding split-screen redesign (Prompt 5)

New file `src/components/OnboardingLayout.tsx`: split layout with dark left panel (radial-gradient `#0D2A6E → #0A0F1E`), `ReportAirLockup` top-left, headline with `"10 minutes."` highlighted in `#1A6EFF`, glassmorphism testimonial card. Right white panel with step indicator (1/2/3) using `#1A6EFF` active pill. Hidden on mobile (`hidden lg:flex`).

Refactor `src/pages/Auth.tsx` sign-up tab to render under `<OnboardingLayout step={1}>` when in signup mode (keep sign-in tab unchanged route — only redesign signup view). Keep all existing supabase auth + Google OAuth logic.

Refactor `src/pages/Onboarding.tsx` (existing) to wrap in `<OnboardingLayout step={2}>` showing first/last name + team/company + role select + referral source. Persist via existing `profiles` update + `teams` insert flow (no schema changes). On submit → `/onboarding/plan`.

New page `src/pages/onboarding/Plan.tsx` registered in `App.tsx` at `/onboarding/plan` (protected). Wrapped in `<OnboardingLayout step={3}>`. Monthly/Annual toggle, three plan cards (Solo/Pro/Studio) sourced from existing pricing constants used on `Index.tsx`. "Start free trial" calls existing `stripe-checkout` edge function with selected plan + interval; "Skip for now" navigates to `/projects` and shows toast.

## Step 3 — New Event slide-in panel (Prompt 6)

New file `src/components/NewEventPanel.tsx` using shadcn `Sheet` (`side="right"`, `w-full sm:w-[480px]`). 3 steps with header pill indicator + footer Back/Next/Create:
- Step 1: event name (required), event type select, location with map placeholder.
- Step 2: build start date, event date, client name, status.
- Step 3: Solo plan → upgrade card linking to `/billing`; Pro/Studio → `InviteTeamField` (email tag list).

Inline helpers `FormField`, `FormSelect`, `FormDateField`, `InviteTeamField` defined in same file (semantic tokens where possible, hex `#1A6EFF` accents per spec).

Create logic: reuse the existing project-create code path from `NewProjectDialog.finish()` — insert into `projects`, then `areas` (none here), then `project_invites` + `send-invite-email` edge function for invitees. No schema changes.

Wire into `src/pages/Projects.tsx`:
- Add `const [newEventPanelOpen, setNewEventPanelOpen] = useState(false);`
- Existing `NewEventButton` `onClick` → `setNewEventPanelOpen(true)`.
- Mount `<NewEventPanel open={...} onClose={...} teamId={...} onCreated={loadProjects} />` at the bottom.
- Leave existing `NewProjectDialog` import/usage in place if referenced elsewhere; only switch the Events list trigger.

## Verification
After each step, confirm TypeScript build succeeds and the specific user flow works (project detail loads, onboarding pages render, New Event sheet creates a project and refreshes the list).

## Files touched
- edit: `src/pages/ProjectDetail.tsx`, `src/pages/Auth.tsx`, `src/pages/Onboarding.tsx`, `src/pages/Projects.tsx`, `src/App.tsx`
- create: `src/components/OnboardingLayout.tsx`, `src/pages/onboarding/Plan.tsx`, `src/components/NewEventPanel.tsx`

No DB migrations, no auth changes, no edge function changes.
