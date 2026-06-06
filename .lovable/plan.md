## Goal
Make `hello@buildfolder.com` reliably forward to `ben.jameslee@gmail.com` via ImprovMX, and make replies to lead-magnet emails go straight to the same inbox via a permanent `Reply-To` header on the Resend send.

---

## Part 1 — Code change (I'll do this)

**File:** `supabase/functions/lead-magnet-signup/index.ts`

Add `reply_to: "ben.jameslee@gmail.com"` to the Resend API call body. One-line addition next to `from`, `to`, `subject`, `html`. No other logic changes.

Then redeploy the `lead-magnet-signup` function.

That's the only code change. Everything else is DNS work you'll do at Lovable's DNS manager and a few clicks in ImprovMX — I can't do those from here.

---

## Part 2 — DNS changes (you'll do this in Lovable)

Go to **Project Settings → Domains → buildfolder.com → ⋯ → Configure → Manage DNS records**.

### Step A — Delete the stale SES inbound MX
Find the row:
- Type: `MX`, Host: `@`, Value: `inbound-smtp.ap-northeast-1.amazonaws.com`, Priority: `10`

Delete it. This is the record that's currently black-holing inbound mail.

### Step B — Add ImprovMX's two MX records on the root
Add these two new records (both on the root, `@`):

| Type | Host | Value | Priority |
|---|---|---|---|
| MX | `@` | `mx1.improvmx.com` | 10 |
| MX | `@` | `mx2.improvmx.com` | 20 |

### Step C — Add ImprovMX to your existing SPF record
You currently have `TXT send → v=spf1 include:amazonses.com ~all` (Resend's SPF, on the `send` subdomain — leave it alone).

ImprovMX needs SPF on the **root**. Add a new TXT record:

| Type | Host | Value |
|---|---|---|
| TXT | `@` | `v=spf1 include:spf.improvmx.com ~all` |

If the root `@` already has an SPF record (it shouldn't, based on what you've shared), merge instead of adding a second one — only one SPF record per host is valid. The merged form would be `v=spf1 include:spf.improvmx.com include:amazonses.com ~all`.

### Step D — Leave these alone
- A `@` / A `www` → `185.158.133.1` (site hosting)
- TXT `_lovable` / `_lovable.www` (Lovable verification)
- TXT `resend._domainkey` (Resend DKIM)
- TXT `_dmarc` (Resend DMARC)
- TXT `send` and MX `send` (Resend SPF + Return-Path)

---

## Part 3 — ImprovMX setup (you'll do this at improvmx.com)

1. Go to https://improvmx.com, sign up (free tier covers what you need).
2. Click **Add Domain** → enter `buildfolder.com`.
3. ImprovMX will show you the two MX records from Step B — you've already added them, so it'll verify quickly (usually minutes).
4. Under the domain, click **Add Alias**:
   - Alias: `hello`
   - Forward to: `ben.jameslee@gmail.com`
5. Save.

Optional but recommended: add a catch-all alias (`*` → `ben.jameslee@gmail.com`) so typos like `helo@`, `info@`, etc. don't bounce.

---

## Part 4 — Verification checklist

Do these in order after DNS has propagated (5–30 min for ImprovMX usually):

1. **Inbound test:** From your personal Gmail, send a plain email to `hello@buildfolder.com`. Confirm it lands in `ben.jameslee@gmail.com` within ~1 minute. (It'll show `via improvmx.com` in the headers — that's normal.)
2. **Resend Reply-To test:** Submit the lead-magnet form on the live site with a test address you control. Open the email you receive, hit Reply, send. Confirm the reply lands in `ben.jameslee@gmail.com` directly (not via ImprovMX — `Reply-To` routes it straight to Gmail).
3. **Belt-and-suspenders test:** Reply to that same lead-magnet email but manually change the To: field to `hello@buildfolder.com`. Confirm it also arrives via ImprovMX. This proves both paths work.
4. **Resend dashboard check:** Confirm `buildfolder.com` shows **Verified** in Resend. The DNS changes above don't touch Resend's records, so verification should be unaffected — but worth a glance.
5. **Spam check:** Look in Gmail's Spam folder for the first test in case Gmail is suspicious of the new sender pattern. Mark as Not Spam once if needed.

---

## Technical notes

- ImprovMX rewrites the envelope sender to `<alias>@improvmx.com` so SPF passes at Gmail's side — that's why we don't need to add Amazon SES to the root SPF.
- `Reply-To` is a header, not an envelope change, so it has no DNS or deliverability impact. Resend supports it via the `reply_to` field in the `/emails` POST body.
- Keeping Resend's `send` subdomain records untouched means outbound deliverability is unchanged.
- No NS migration, no AWS work, no nameserver change. Lovable stays your DNS host.

---

## Rollback

If anything goes wrong inbound, re-adding the SES MX (`@ → inbound-smtp.ap-northeast-1.amazonaws.com`, priority 10) and removing the ImprovMX MX rows returns to today's broken-but-known state. The code change is independent and harmless to leave in place.
