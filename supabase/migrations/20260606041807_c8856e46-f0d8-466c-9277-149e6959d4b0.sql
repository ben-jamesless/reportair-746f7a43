CREATE TABLE public.lead_magnet_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  source text,
  pdf_slug text NOT NULL DEFAULT 'default',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.lead_magnet_signups TO anon, authenticated;
GRANT ALL ON public.lead_magnet_signups TO service_role;

ALTER TABLE public.lead_magnet_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "LeadMagnet: anyone can sign up"
  ON public.lead_magnet_signups FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "LeadMagnet: admins read"
  ON public.lead_magnet_signups FOR SELECT
  TO authenticated
  USING (is_platform_admin());

CREATE POLICY "LeadMagnet: admins delete"
  ON public.lead_magnet_signups FOR DELETE
  TO authenticated
  USING (is_platform_admin());

CREATE INDEX lead_magnet_signups_created_at_idx ON public.lead_magnet_signups (created_at DESC);