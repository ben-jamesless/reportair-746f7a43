CREATE TABLE public.newsletter_signups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL,
  source TEXT,
  synced_to_resend BOOLEAN NOT NULL DEFAULT false,
  resend_contact_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX newsletter_signups_email_lower_idx
  ON public.newsletter_signups (lower(email));

ALTER TABLE public.newsletter_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Newsletter: anyone can sign up"
  ON public.newsletter_signups
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Newsletter: admins read"
  ON public.newsletter_signups
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

CREATE POLICY "Newsletter: admins delete"
  ON public.newsletter_signups
  FOR DELETE
  TO authenticated
  USING (public.is_platform_admin());