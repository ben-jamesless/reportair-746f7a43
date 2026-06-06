ALTER TABLE public.lead_magnet_signups
  ADD COLUMN IF NOT EXISTS resend_status integer,
  ADD COLUMN IF NOT EXISTS resend_message_id text;