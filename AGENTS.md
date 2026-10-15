# Architecture rules
- Store beta access requests separately from marketing subscriptions and protect approval with platform-admin RLS so public requests cannot grant access.
- Enforce new-account beta eligibility through an app-owned auth lifecycle trigger using approved emails or pending project invites, never URL parameters or user metadata.
- Keep public early-access forms shared across holding pages and signup entry points so submission behavior remains consistent.
- Generate PDF ranges as combined daily portrait reports; use shared mixed-script drawing and measurement with brand fonts plus an international-only fallback so foreign venue text never changes Latin typography or requires WinAnsi.