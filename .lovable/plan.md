# Auto-chained phase dates in the Event timeline

Make phases follow on from each other instead of every new phase defaulting to today.

## Behaviour

- Adding the **first** phase: starts today, ends today (unchanged).
- Adding any **later** phase: starts on the end date of the last phase already in the list, and ends on that same date (so you only have to change the end).
- Changing a phase's **end date**: the phase that comes next in the timeline has its start date moved to match, so the chain stays continuous. Phases after that are left alone unless their start now sits before their own start — no cascading date shuffles.
- Guard: if a phase's end date is set earlier than its start date, the end is clamped to the start.
- Phases stay ordered by start date, and the existing "one of each kind" rule and the automatic build-window end date are unchanged.

## Technical notes

- All in `src/components/EventPhasesEditor.tsx`; no database or backend change.
- `addPhase` picks the seed date as `max(end_date)` of existing rows, falling back to today.
- `patch` gains a follow-on step: when `end_date` changes, find the next phase by start order and update its `start_date` (and its `end_date` if that would now be earlier) in the same save round, then re-sync `build_end_date`.
