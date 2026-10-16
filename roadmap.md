# Beta access
- [x] Replace public pricing and signup calls to action with Coming soon / Request early access.
- [x] Save access requests and let platform administrators approve them.
- [x] Enforce invitation-only signup while preserving existing users and project invites.
- [x] Verify the request submission, admin approval readback, and unapproved signup denial.

# PDF export
- [x] Repair PDF generation failure and date-range coverage.
- [x] Simplify branded popup: portrait only, compressed/large, current date/range without tabs or albums.
- [x] Verify generated PDFs and downloads through the real export flow.

# PDF typography corrections
- [x] Use platform fonts with international-text fallback and consistent character spacing.
- [x] Correct logo placement, timezone divider, and area heading layout.
- [x] Verify a real report download and visually inspect every generated page.

# PDF build-day numbering
- [x] Use scheduled build start and count every calendar day, including upload gaps.
- [x] Verify regression tests and a fresh PDF export.
# Analytics platform (later)
- [ ] Replace the unreliable share-link view counters with a proper analytics platform (accurate client opens, team previews, and engagement over time).

# Beta membership simplification
- [x] Unlimited beta entitlements, protected billing history and hidden commercial UI.
- [x] Owner-only colleague invitations with company/project acceptance and simple roles.
- [x] Wire access-request, approval and invitation emails to the chosen shared inbox and registered templates; retain copied-link fallback.
- [ ] Verify inbox delivery after sender-domain verification (blocked: notify.reportair.co verification timed out; retry through Cloud → Emails).
- [x] Optional share expiry and admin-only factual usage reporting.
- [x] Verify signed-in invitation creation/acceptance/readback, beta PDF download, share expiry/readback, public report and paid-tier regression tests; inventory in beta-membership-verification.md.

## Brand guide rollout (draft "Brand guide rollout" — not published)
- [x] Phase 1 audit (reported in chat)
- [~] Phase 2 visual tokens: Inter, ink/zinc palette, progress colours, section-header tokens, sentence case, light sidebar — done; remaining: card/control radii pass, share-page components, PDF fonts (Geist→Inter in generate-pdf, needs function deploy approval)
- [ ] Phase 3 navigation: remove Overview tab, standard event toolbar, tab highlight spec, Crew capture-only screen
- [ ] Phase 3 pages: Daily Report headers + 6/5/4/3/2 galleries, Library 8/6/4 grid, Map floating Event areas panel, Export dialog "Export PDF", company branding simplification
- [ ] Acceptance tests from brief (roles, cross-company, client links)
