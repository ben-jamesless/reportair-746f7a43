## Goal

Let users delete an area directly from the project sidebar (where they actually look at areas), with a 5-second **Undo** toast so a mis-click is recoverable. Photos previously tagged to the area fall back to "Unassigned" while deleted, and reappear under the area on undo.

## UX

In `src/features/projectDetail/DayTimeline.tsx` — the AREAS list at lines 367–384:

- On hover (and always on touch), each area row shows a small trash icon on the right.
- Click trash → row disappears immediately (optimistic), sonner toast appears: **"Area '{name}' deleted"** with an **Undo** action, auto-dismiss after 5s.
- If the user was viewing that area (`activeArea === ar.id`), reset to "All areas".
- After 5s with no undo → the soft delete becomes permanent from the user's perspective (the row stays gone; row remains in DB with `deleted_at` set, but is filtered out everywhere).
- Undo → row reappears in original position, photos re-show under it.

The existing modal-based delete in `AreasManager.tsx` (Project Settings) stays — but is also switched to the same soft-delete + undo flow for consistency. No more "type to confirm"; the undo toast is the safety net.

## Technical changes

### 1. Database — soft delete column

Migration on `public.areas`:

```sql
ALTER TABLE public.areas ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX areas_project_active_idx ON public.areas (project_id) WHERE deleted_at IS NULL;
```

No FK / RLS changes needed — `photos.area_id` keeps pointing at the row, it's just filtered from queries.

### 2. Query filters

Every `from("areas").select(...)` call must add `.is("deleted_at", null)`. Files to update:

- `src/features/projectDetail/useProjectDetail.ts` (the main areas load, ~line 125)
- `src/components/AreasManager.tsx` (the load() function)
- `src/pages/SharePage.tsx` (if it pulls areas)
- Edge function `supabase/functions/generate-pdf/` if it joins areas

And anywhere `photos` are grouped by area, treat photos whose `area_id` points to a soft-deleted area as **unassigned** (compute via "area exists in active list?" rather than just `area_id != null`). The grouping helpers in `useProjectDetail.ts` already key off the `areas` array, so once that array is filtered they'll just work — but verify the `areaCountsForDay` / `areaIdsForPhoto` paths.

### 3. Hook API — extend `useProjectDetail`

Add two callbacks alongside `addArea`:

- `softDeleteArea(id)` → `update({ deleted_at: now() }).eq("id", id)`, then optimistic local state removal.
- `restoreArea(id)` → `update({ deleted_at: null }).eq("id", id)`, then refetch / re-insert into local state at original `sort_order`.

Expose both from the hook return and pass through `ProjectDetail.tsx` → `DayTimeline` (new prop `onDeleteArea`) and reuse in `AreasManager`.

### 4. Sidebar row UI

Modify the area `<button>` (DayTimeline.tsx lines 370–383) into a flex row with:

- The existing label button (click = select area)
- A trailing `<button>` with `<Trash2 className="h-3.5 w-3.5" />` from lucide-react, shown via `opacity-0 group-hover:opacity-100` on the parent + always visible on `sm:hidden` (touch).
- `stopPropagation` on the trash click so it doesn't toggle selection.
- Gated by `canEdit`.

### 5. Toast with undo

```ts
const onDeleteArea = (ar: Area) => {
  softDeleteArea(ar.id);
  if (activeArea === ar.id) onSetActiveArea(null);
  toast(`Area "${ar.name}" deleted`, {
    action: { label: "Undo", onClick: () => restoreArea(ar.id) },
    duration: 5000,
  });
};
```

(`sonner` is already used project-wide.)

### 6. AreasManager.tsx cleanup

Replace the existing `AlertDialog`-based hard delete with the same soft-delete + undo toast. Remove `pendingDeleteId`, `pendingDeleteArea`, and the `<AlertDialog>` block. Keep the trash button.

## Out of scope

- A "Trash / recently deleted" UI to restore areas after the 5s window expires. (Possible follow-up — the `deleted_at` column makes it trivial.)
- A scheduled job to hard-delete rows after N days.
- Bulk multi-select delete.

## Verification

- Hover an area in the sidebar → trash appears → click → row vanishes, toast shows.
- Click **Undo** within 5s → row returns at the same position, photos re-show.
- Let toast expire → row stays gone, photos appear in "Unassigned", PDF export shows them as unassigned.
- AreasManager in Project Settings behaves the same way.
- Share links / public report views don't show deleted areas.
