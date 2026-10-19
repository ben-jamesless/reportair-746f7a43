# Share page: no photos yet today

## Recommendation
Do both, in one clear pattern: when today has nothing yet, the share page opens on the **most recent day with an update** and says so plainly, with a one-click way back to today.

Showing old photos without a date label would mislead clients. A placeholder alone leaves the page looking empty for most of the day. Showing the latest update with its date makes the page useful and stays honest.

## What the client sees
- A thin notice above the area list:
  "Today's update (Mon 19 Oct) usually arrives at the end of the day. Showing the latest update from **Sun 18 Oct**." with a "View today" link.
- The calendar highlights 18 Oct as the selected day; today stays marked as today.
- Area rows, the day summary and the right-hand panels all show 18 Oct content, labelled "18 Oct" instead of "today" (e.g. "Photos on 18 Oct", "No update on 18 Oct").
- Clicking "View today" (or 19 in the calendar) shows today as now, but the empty state becomes a short message instead of five greyed rows: "No photos uploaded yet today. Updates usually arrive end of day. See latest: 18 Oct →". Today's objectives still show if set.
- Once any photo is uploaded today, the page opens on today as normal.
- The top bar changes from "0 photos today" to "Latest update 18 Oct · 12 photos" while in this fallback.

## Rules
- Only applies to live (not filed) events, and only when today has zero photos and no area updates.
- "Latest day" = the most recent earlier day with photos or area notes/status, within the event's timeline.
- If no day has any updates yet, keep today with the empty message (no fallback).
- A day picked in the calendar or from a link always wins over the fallback.

## Technical notes
- Change in `SharePageV2.tsx` where the initial active date is chosen; derive the fallback from the existing heatmap/day data already loaded, no backend changes.
- Pass a `isFallbackDay` flag to the day summary, area list, status-at-a-glance and stat panels to swap "today" wording for the date.
- Add a small test for the "pick latest day" rule (today empty → latest earlier active day; today has photos → today; nothing ever → today).
