# Share link v2 (OnShow client report) — feasibility review

Analysis of the uploaded `OnShow_ClientReport.html` against the live share page (`src/pages/SharePage.tsx`, ~1,700 lines, driven by the `resolve_share_link` RPC).

## What we can already do today

These parts of the mockup map onto data we hold and render already:

- Masthead: project name, date, venue/address, event logo (share logo path + brand colour RPCs exist).
- Status bar: overall status, weather chip (`project-weather` edge function is already wired to the share token), last-updated.
- Zone-by-zone cards: area name, status pill, day notes, photo grid with capture times — this is essentially today's share page reorganised.
- Sidebar "Today's summary": today's objectives / achievements / tomorrow already exist as day notes.
- Zone status at a glance and the day timeline dots: derivable from `area_day_status`.
- Feedback box: guest notes already exist on the public link.

So roughly 60% of the design is a re-layout, not new capability.

## The real issues and concerns

### 1. Build calendar (groundbreak → teardown) — new data model
The Gantt strip needs things we don't store: a build window (start/end), named phases (Build wk1, Build wk2, Event week, Takedown), and a "worst status" roll-up row. Today a project has days only implicitly, from whatever data exists. This needs new project fields plus a phase table, and an editing surface for them — the largest single piece of work here.

### 2. "Day 3 of 18" and the stat strip
Day counter, days remaining, "zones active", "open issues" all depend on the same build window. "Open issues" also needs a definition — presumably a count of areas at Flagged/Delayed today. Cheap once (1) lands, impossible before it.

### 3. Map: cost, key exposure, privacy
The mockup shows an interactive map with a Map/Satellite toggle, zone polygons, photo pins and a legend. On a public, unauthenticated link that means:
- Google Maps JS loads for anyone with the URL — billable per load and the browser key is exposed to the open internet. Recommend the existing `static-map` proxy (satellite still, no toggle) for the share page, or an aggressive per-token load cap.
- Photo pins publish exact GPS of every photo. That's a real disclosure decision for client-facing links; suggest pins off by default, per-link opt-in.

### 4. Live/realtime badge
The pulsing "LIVE" badge implies realtime updates for anonymous viewers. Our share data comes from a single RPC snapshot. Realtime for anon would need channel exposure on public tables; a 60s poll of the existing RPC is safer and visually identical.

### 5. Public comment box (spam)
The mockup puts an always-open comment input on a page anyone with the URL can reach. Guest notes exist, but a day-level thread on a public page needs rate limiting, length caps and a moderation/removal view for the owner. Currently there's no throttle.

### 6. Branding and entitlement
The mockup is fully white-labelled to an agency (On Show lockup, agency colour, ops contact block with a named person and role). We only support a logo and one brand colour. Full white-label is a paid-tier feature per the membership spec, so this design ships gated — and the ops contact block means storing contact details we then publish publicly.

### 7. Design-system conflicts
- The mockup uses 4–6px rounded corners throughout; the app was deliberately squared off (`rounded-none`) a while back. Needs a decision: share page is an exception, or the mockup gets squared.
- It introduces General Sans (Fontshare) alongside Inter/JetBrains Mono — a third webfont and a third-party font host on a page where load speed matters.
- The palette (#0B43D6 On Show blue, red signal dot) is a client theme, not our tokens. Needs to be expressed as themeable variables, not hardcoded.
- The mockup is light-only. Our share page supports dark mode; every new surface needs dark tokens or dark mode gets disabled here.

### 8. Status vocabulary drift
The mockup uses Not started / In progress / Flagged / Delayed / Complete. Our enum is `no_status | on_track | requires_discussion | concern | complete`, surfaced as No status / On track / Flagged / Delayed / Complete. Close, but "Not started" vs "No status" vs the card's "No update today" are three different labels for one state — needs pinning down before build.

### 9. Layout and responsive
Three-column masthead, 4-up stat strip, 1fr+400px body and a horizontally scrolling calendar all need mobile treatment. The recent mobile work on the share page (stacked filters, side-by-side dropdowns) would need redoing against the new structure.

### 10. Payload and performance
`resolve_share_link` already returns the whole project as one JSON blob. Add 18 days × areas × statuses × photos plus calendar data and it grows fast. Likely needs day-scoped fetching or a trimmed summary payload for first paint.

### 11. PDF export drifts
`generate-pdf` renders its own layout. Shipping a new share design without touching it means the emailed/exported PDF no longer looks like the link the client saw.

## Non-negotiable: v1 stays live

v2 is built as a separate surface. Nothing about the current client link changes until we deliberately switch it.

- Existing `/s/:token` keeps rendering today's `SharePage.tsx`, untouched. No refactors "in passing".
- v2 lives at a parallel route (e.g. `/s2/:token`) using the same tokens, so any existing link can be previewed in v2 without reissuing it.
- New v2 components go in their own folder (`src/features/sharePageV2/`) rather than editing v1 files. Shared helpers get copied, not extracted, until v2 is settled.
- Any new share RPCs are additive and versioned (e.g. `resolve_share_link_v2`); `resolve_share_link` keeps its current shape so v1 can't break.
- Schema additions (build window, phases) are nullable and ignored by v1.
- Switchover later is a per-link or per-team flag, reversible, with v1 kept as fallback for a period.

## Suggested sequencing (if we proceed)

1. **Scaffold v2 in parallel** — `/s2/:token` route + `sharePageV2` folder rendering the new shell against existing data. v1 untouched.
2. **Foundations** — build window + phases on the project (nullable), status vocabulary locked, additive v2 payload RPC.
3. **Re-layout** — masthead, status bar, stat strip, zone cards, sidebar summary/timeline/feedback using existing data. Highest visual return, lowest risk.
4. **Calendar** — the Gantt strip plus its editing surface.
5. **Map** — static satellite by default, polygons on, pins behind a per-link toggle.
6. **Branding/white-label** — agency lockup, theme colour, ops contact, gated by tier.
7. **Switchover + PDF parity** — flag v2 on per link, then bring the export in line. v1 removed only once v2 has run real events.


## Open questions before planning the build

- Is the On Show branding a per-client theme we must support generically, or is this one customer's skin?
- Do we publish photo GPS pins on public links?
- Keep dark mode on the share page?
- Rounded corners here, or square to match the rest of the app?
