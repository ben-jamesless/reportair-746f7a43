CREATE TABLE public.early_access_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 email text NOT NULL UNIQUE,
 full_name text NOT NULL,
 company text,
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','declined')),
 created_at timestamptz NOT NULL DEFAULT now(),
 reviewed_at timestamptz
);
GRANT SELECT, UPDATE ON public.early_access_requests TO authenticated;
GRANT ALL ON public.early_access_requests TO service_role;
ALTER TABLE public.early_access_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins read access requests" ON public.early_access_requests FOR SELECT TO authenticated USING (public.is_platform_admin());
CREATE POLICY "Platform admins review access requests" ON public.early_access_requests FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE OR REPLACE FUNCTION public.request_early_access(_email text, _full_name text, _company text DEFAULT '', _website text DEFAULT '') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE normalized text := lower(trim(_email));
BEGIN
 IF coalesce(_website,'') <> '' THEN RETURN; END IF;
 IF normalized IS NULL OR length(normalized) > 254 OR normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR coalesce(length(trim(_full_name)),0) NOT BETWEEN 1 AND 120 OR length(coalesce(_company,'')) > 200 THEN RAISE EXCEPTION 'Please enter a valid name and email.'; END IF;
 INSERT INTO public.early_access_requests(email, full_name, company) VALUES(normalized, trim(_full_name), nullif(trim(_company),'')) ON CONFLICT(email) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.request_early_access(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_early_access(text,text,text,text) TO anon, authenticated, service_role;
CREATE OR REPLACE FUNCTION public.enforce_beta_invitation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 IF EXISTS (SELECT 1 FROM public.early_access_requests WHERE email=lower(trim(NEW.email)) AND status='approved') OR EXISTS (SELECT 1 FROM public.project_invites i JOIN public.projects p ON p.id=i.project_id WHERE lower(i.email)=lower(NEW.email) AND i.accepted_at IS NULL AND p.archived_at IS NULL) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'BuildFolder is invitation-only during beta. Please request early access.';
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_beta_invitation() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER enforce_beta_invitation BEFORE INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.enforce_beta_invitation();