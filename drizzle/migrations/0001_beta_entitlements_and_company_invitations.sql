ALTER TABLE public.teams ADD COLUMN previous_plan text, ADD COLUMN billing_plan text, ADD COLUMN beta_joined_at timestamptz, ADD COLUMN founding_member boolean NOT NULL DEFAULT true;
UPDATE public.teams SET previous_plan=plan, billing_plan=plan;
ALTER TABLE public.teams DROP CONSTRAINT teams_plan_check;
ALTER TABLE public.teams ADD CONSTRAINT teams_plan_check CHECK (plan IN ('free','solo','crew','studio','beta'));
ALTER TABLE public.teams ALTER COLUMN plan SET DEFAULT 'beta';
CREATE OR REPLACE FUNCTION public.protect_beta_entitlement() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF auth.role()='authenticated' THEN NEW.plan:='beta'; NEW.beta_joined_at:=now(); NEW.previous_plan:='free'; NEW.billing_plan:='free'; END IF;
  RETURN NEW;
 END IF;
 IF auth.role()='authenticated' AND NOT public.is_platform_admin() THEN
  IF NEW.plan IS DISTINCT FROM OLD.plan OR NEW.previous_plan IS DISTINCT FROM OLD.previous_plan OR NEW.billing_plan IS DISTINCT FROM OLD.billing_plan OR NEW.beta_joined_at IS DISTINCT FROM OLD.beta_joined_at OR NEW.founding_member IS DISTINCT FROM OLD.founding_member THEN RAISE EXCEPTION 'Only platform administrators can change account entitlements'; END IF;
 END IF;
 IF OLD.plan='beta' AND NEW.plan<>'beta' AND auth.role()='service_role' THEN NEW.billing_plan:=NEW.plan; NEW.plan:='beta'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_beta_entitlement BEFORE INSERT OR UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.protect_beta_entitlement();
CREATE OR REPLACE FUNCTION public.plan_core_cap(_plan text,_addon integer) RETURNS integer LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT CASE lower(coalesce(_plan,'free')) WHEN 'free' THEN 1 WHEN 'solo' THEN 1 WHEN 'crew' THEN 5+coalesce(_addon,0) WHEN 'studio' THEN 2147483647 WHEN 'beta' THEN 2147483647 ELSE 1 END $$;
CREATE OR REPLACE FUNCTION public.plan_allows_externals(_plan text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT lower(coalesce(_plan,'free')) IN ('crew','studio','beta') $$;
CREATE OR REPLACE FUNCTION public.beta_member_defaults() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF EXISTS(SELECT 1 FROM public.teams WHERE id=NEW.team_id AND plan='beta') THEN NEW.member_type:='core'; END IF; RETURN NEW; END $$;
CREATE TRIGGER aaa_beta_member_defaults BEFORE INSERT ON public.team_members FOR EACH ROW EXECUTE FUNCTION public.beta_member_defaults();
CREATE TABLE public.company_invites (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),team_id uuid NOT NULL REFERENCES public.teams(id),email text NOT NULL,role public.project_role NOT NULL DEFAULT 'editor',token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),invited_by uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),expires_at timestamptz NOT NULL DEFAULT (now()+interval '14 days'),accepted_at timestamptz,accepted_by uuid,cancelled_at timestamptz,delivery_status text NOT NULL DEFAULT 'not_sent',delivery_error text, CHECK(role IN ('editor','crew','viewer')));
GRANT SELECT ON public.company_invites TO authenticated;
GRANT ALL ON public.company_invites TO service_role;
ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company owners read invitations" ON public.company_invites FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.teams t WHERE t.id=team_id AND t.billing_owner_user_id=auth.uid()));
CREATE TABLE public.company_invite_projects (invite_id uuid NOT NULL REFERENCES public.company_invites(id) ON DELETE CASCADE,project_id uuid NOT NULL REFERENCES public.projects(id),PRIMARY KEY(invite_id,project_id));
GRANT SELECT ON public.company_invite_projects TO authenticated;
GRANT ALL ON public.company_invite_projects TO service_role;
ALTER TABLE public.company_invite_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Company owners read invite assignments" ON public.company_invite_projects FOR SELECT TO authenticated USING (EXISTS(SELECT 1 FROM public.company_invites i JOIN public.teams t ON t.id=i.team_id WHERE i.id=invite_id AND t.billing_owner_user_id=auth.uid()));
CREATE OR REPLACE FUNCTION public.create_company_invite(_team_id uuid,_email text,_project_ids uuid[],_role public.project_role) RETURNS public.company_invites LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE result public.company_invites; BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS(SELECT 1 FROM public.teams WHERE id=_team_id AND billing_owner_user_id=auth.uid() AND suspended_at IS NULL AND plan='beta') THEN RAISE EXCEPTION 'Only the company owner can invite colleagues'; END IF;
 IF _role NOT IN ('editor','crew','viewer') OR coalesce(array_length(_project_ids,1),0)=0 OR array_length(_project_ids,1)>100 THEN RAISE EXCEPTION 'Choose projects and a valid role'; END IF;
 IF lower(trim(_email)) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' OR length(_email)>254 THEN RAISE EXCEPTION 'Enter a valid email'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(_project_ids) p(id) WHERE NOT EXISTS(SELECT 1 FROM public.projects WHERE id=p.id AND team_id=_team_id AND archived_at IS NULL)) THEN RAISE EXCEPTION 'Projects must belong to this company'; END IF;
 IF EXISTS(SELECT 1 FROM public.company_invites WHERE team_id=_team_id AND email=lower(trim(_email)) AND accepted_at IS NULL AND cancelled_at IS NULL AND expires_at>now()) THEN RAISE EXCEPTION 'An invitation is already pending for this colleague'; END IF;
 INSERT INTO public.company_invites(team_id,email,role,invited_by) VALUES(_team_id,lower(trim(_email)),_role,auth.uid()) RETURNING * INTO result;
 INSERT INTO public.company_invite_projects(invite_id,project_id) SELECT result.id,id FROM (SELECT DISTINCT unnest(_project_ids) AS id) p;
 RETURN result; END $$;
REVOKE ALL ON FUNCTION public.create_company_invite(uuid,text,uuid[],public.project_role) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_company_invite(uuid,text,uuid[],public.project_role) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.cancel_company_invite(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN UPDATE public.company_invites i SET cancelled_at=now() WHERE i.id=_id AND i.accepted_at IS NULL AND EXISTS(SELECT 1 FROM public.teams WHERE id=i.team_id AND billing_owner_user_id=auth.uid()); IF NOT FOUND THEN RAISE EXCEPTION 'Invitation not found or not owned'; END IF; END $$;
REVOKE ALL ON FUNCTION public.cancel_company_invite(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.cancel_company_invite(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.get_company_invite_context(_token uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE i public.company_invites; BEGIN SELECT * INTO i FROM public.company_invites WHERE token=_token AND cancelled_at IS NULL AND (accepted_at IS NOT NULL OR expires_at>now()); IF NOT FOUND THEN RETURN NULL; END IF; RETURN jsonb_build_object('email',i.email,'company_name',(SELECT name FROM public.teams WHERE id=i.team_id),'account_exists',EXISTS(SELECT 1 FROM auth.users WHERE lower(email)=i.email),'accepted',i.accepted_at IS NOT NULL); END $$;
REVOKE ALL ON FUNCTION public.get_company_invite_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_company_invite_context(uuid) TO anon,authenticated,service_role;
CREATE OR REPLACE FUNCTION public.accept_company_invite(_token uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE i public.company_invites; u_email text; first_project uuid; BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to accept this invitation'; END IF;
 SELECT lower(email) INTO u_email FROM auth.users WHERE id=auth.uid() AND (email_confirmed_at IS NOT NULL OR phone_confirmed_at IS NOT NULL);
 IF u_email IS NULL OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND suspended_at IS NOT NULL) THEN RAISE EXCEPTION 'Confirm your account before accepting'; END IF;
 SELECT * INTO i FROM public.company_invites WHERE token=_token FOR UPDATE;
 IF NOT FOUND OR i.email<>u_email OR i.cancelled_at IS NOT NULL OR (i.accepted_at IS NULL AND i.expires_at<=now()) OR (i.accepted_at IS NOT NULL AND i.accepted_by<>auth.uid()) THEN RAISE EXCEPTION 'This invitation is invalid, expired or belongs to another email'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.teams WHERE id=i.team_id AND suspended_at IS NULL AND plan='beta') THEN RAISE EXCEPTION 'This company is unavailable'; END IF;
 IF i.accepted_at IS NULL THEN
 INSERT INTO public.team_members(team_id,user_id,role,member_type) VALUES(i.team_id,auth.uid(),'member','core') ON CONFLICT(team_id,user_id) DO NOTHING;
 INSERT INTO public.project_members(project_id,user_id,role) SELECT p.id,auth.uid(),i.role FROM public.company_invite_projects ip JOIN public.projects p ON p.id=ip.project_id WHERE ip.invite_id=i.id AND p.team_id=i.team_id AND p.archived_at IS NULL ON CONFLICT(project_id,user_id) DO NOTHING;
 UPDATE public.company_invites SET accepted_at=now(),accepted_by=auth.uid() WHERE id=i.id;
 UPDATE public.profiles SET onboarded_at=coalesce(onboarded_at,now()) WHERE id=auth.uid();
 END IF;
 SELECT project_id INTO first_project FROM public.company_invite_projects ip JOIN public.projects p ON p.id=ip.project_id WHERE invite_id=i.id AND p.archived_at IS NULL ORDER BY p.created_at LIMIT 1;
 RETURN first_project; END $$;
REVOKE ALL ON FUNCTION public.accept_company_invite(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_company_invite(uuid) TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.accept_my_company_invites() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ DECLARE i record; n integer:=0; BEGIN IF auth.uid() IS NULL THEN RETURN 0; END IF; FOR i IN SELECT token FROM public.company_invites WHERE email=lower((SELECT email FROM auth.users WHERE id=auth.uid())) AND accepted_at IS NULL AND cancelled_at IS NULL AND expires_at>now() LOOP PERFORM public.accept_company_invite(i.token); n:=n+1; END LOOP; RETURN n; END $$;
REVOKE ALL ON FUNCTION public.accept_my_company_invites() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.accept_my_company_invites() TO authenticated,service_role;
CREATE OR REPLACE FUNCTION public.enforce_beta_invitation() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.early_access_requests WHERE email=lower(trim(NEW.email)) AND status='approved') OR EXISTS(SELECT 1 FROM public.project_invites i JOIN public.projects p ON p.id=i.project_id WHERE lower(i.email)=lower(NEW.email) AND i.accepted_at IS NULL AND p.archived_at IS NULL) OR EXISTS(SELECT 1 FROM public.company_invites i JOIN public.teams t ON t.id=i.team_id WHERE i.email=lower(NEW.email) AND i.accepted_at IS NULL AND i.cancelled_at IS NULL AND i.expires_at>now() AND t.suspended_at IS NULL) THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'BuildFolder is invitation-only during beta. Please request early access.'; END $$;
ALTER POLICY "Comments: editors insert" ON public.comments WITH CHECK (public.has_project_role(auth.uid(),project_id,ARRAY['owner','editor','viewer','commenter']::public.project_role[]) AND auth.uid()=author_id);
CREATE OR REPLACE FUNCTION public.is_team_project_manager(_user_id uuid,_team_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.team_members WHERE team_id=_team_id AND user_id=_user_id AND role IN ('owner','admin')) $$;
REVOKE ALL ON FUNCTION public.is_team_project_manager(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_team_project_manager(uuid,uuid) TO authenticated,service_role;
ALTER POLICY "Projects: members read" ON public.projects USING(public.is_project_member(auth.uid(),id) OR public.is_team_project_manager(auth.uid(),team_id));
ALTER POLICY "Photos: readers read" ON public.photos USING(public.is_project_reader(auth.uid(),project_id) OR public.is_team_project_manager(auth.uid(),public.project_team_id(project_id)) OR (public.is_project_crew(auth.uid(),project_id) AND uploaded_by=auth.uid()));
ALTER POLICY "DayNotes: members read" ON public.day_notes USING(public.is_project_reader(auth.uid(),project_id) OR public.is_team_project_manager(auth.uid(),public.project_team_id(project_id)));
ALTER POLICY "AreaDayNotes: members read" ON public.area_day_notes USING(public.is_project_reader(auth.uid(),project_id) OR public.is_team_project_manager(auth.uid(),public.project_team_id(project_id)));
ALTER POLICY "AreaDayStatus: members read" ON public.area_day_status USING(public.is_project_reader(auth.uid(),project_id) OR public.is_team_project_manager(auth.uid(),public.project_team_id(project_id)));
ALTER POLICY "Comments: members read" ON public.comments USING(public.is_project_reader(auth.uid(),project_id) OR public.is_team_project_manager(auth.uid(),public.project_team_id(project_id)));