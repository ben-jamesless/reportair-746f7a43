# Email Popup → PDF Lead Magnet

A popup on the marketing site that appears once a visitor scrolls past 50% of the page. They enter their email, get the PDF emailed to them, and we store the lead in the database.

## What you'll see

1. Visitor scrolls past halfway on the homepage → modal slides in
2. Modal: headline, short pitch, email input, "Send me the guide" button
3. On submit: success state ("Check your inbox") + the popup never appears again on this browser
4. They receive a branded email with a download link to the PDF
5. Dismissing (X) also marks it as seen-forever

## The PDF

You didn't specify content. I'll wire everything up against a placeholder file at `public/lead-magnet.pdf`. Once the popup is live, you can either:
- Upload your own PDF to replace it, or
- Tell me what it should contain and I'll generate one

The download link in the email points to a public URL, so swapping the file works without code changes.

## Lead storage

A new `lead_magnet_signups` table:
- email, source (e.g. "homepage-popup"), pdf_slug, created_at
- Anyone can insert (so the popup works without login)
- Only platform admins can read (same pattern as your existing `newsletter_signups`)

## Frequency control

`localStorage` flag `bf_lead_magnet_seen=1` — set on dismiss or successful submit. Once set, popup never shows again in that browser.

## Email delivery

Uses Lovable's built-in email system (your `notify.buildfolder.com` domain is already set up). New transactional template `lead-magnet-delivery` with the PDF download button, branded to match BuildFolder.

## Technical details

- **New files**
  - `src/components/marketing/LeadMagnetPopup.tsx` — modal UI, scroll listener, zod-validated form
  - `supabase/functions/_shared/transactional-email-templates/lead-magnet-delivery.tsx` — React Email template
  - `public/lead-magnet.pdf` — placeholder (you replace)
- **Edits**
  - `src/pages/Index.tsx` — mount `<LeadMagnetPopup />`
  - `supabase/functions/_shared/transactional-email-templates/registry.ts` — register new template
- **Migration**
  - `lead_magnet_signups` table + RLS (anon insert, admin read) + GRANTs
- **Flow on submit**
  1. Client inserts row into `lead_magnet_signups`
  2. Client invokes `send-transactional-email` with `templateName: 'lead-magnet-delivery'`, `templateData: { downloadUrl }`
  3. Show success state
- Idempotency key: `lead-magnet-<signup-row-id>` to prevent duplicate sends on retry
- GA event `lead_magnet_submit` fired on success
