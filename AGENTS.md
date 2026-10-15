# Architecture rules
- Store beta access requests separately from marketing subscriptions and protect approval with platform-admin RLS so public requests cannot grant access.
- Enforce new-account beta eligibility through an app-owned auth lifecycle trigger using approved emails or valid pending company/project invites, never URL parameters or user metadata.
- Keep public early-access forms shared across holding pages and signup entry points so submission behavior remains consistent.
- Generate PDF ranges as combined daily portrait reports; use shared mixed-script drawing and measurement with brand fonts plus an international-only fallback so foreign venue text never changes Latin typography or requires WinAnsi.
- Anchor PDF build-day numbering to the scheduled build phase, with the legacy start only as a fallback; use UTC date-only arithmetic so upload gaps and daylight-saving shifts never change the count.
- Preserve paid billing state separately from beta entitlements and prevent service-role billing updates from replacing active beta access, so billing can resume without destroying history.
- Accept company invitations through authenticated email-matched server functions and explicit project assignments; ordinary company membership must never grant access to every project.
- Keep company invitation screens shared between company and project members panels, so role choices and delivery states remain consistent.
- Keep billing email calls isolated from the registered app-email sender; validate app-email actors and derive recipients and links server-side to prevent arbitrary sends.