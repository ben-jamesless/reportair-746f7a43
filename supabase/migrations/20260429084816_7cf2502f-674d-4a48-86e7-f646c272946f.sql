-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');
CREATE TYPE public.team_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.project_role AS ENUM ('owner', 'editor', 'commenter', 'viewer');
CREATE TYPE public.project_template AS ENUM ('event_production', 'blank');

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  avatar_url TEXT,
  onboarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Global roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role team_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, user_id)
);
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  template project_template NOT NULL DEFAULT 'blank',
  cover_photo_url TEXT,
  archived_at TIMESTAMPTZ,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role project_role NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Helper functions (SECURITY DEFINER to avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_team_member(_user_id UUID, _team_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id) $$;

CREATE OR REPLACE FUNCTION public.has_team_role(_user_id UUID, _team_id UUID, _role team_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.team_members WHERE user_id = _user_id AND team_id = _team_id AND role = _role) $$;

CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.project_members WHERE user_id = _user_id AND project_id = _project_id) $$;

CREATE OR REPLACE FUNCTION public.has_project_role(_user_id UUID, _project_id UUID, _roles project_role[])
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.project_members WHERE user_id = _user_id AND project_id = _project_id AND role = ANY(_roles)) $$;

CREATE OR REPLACE FUNCTION public.project_team_id(_project_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT team_id FROM public.projects WHERE id = _project_id $$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER projects_updated BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- When a team is created, auto-add creator as owner
CREATE OR REPLACE FUNCTION public.handle_new_team()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.team_members (team_id, user_id, role) VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_team_created AFTER INSERT ON public.teams FOR EACH ROW EXECUTE FUNCTION public.handle_new_team();

-- When a project is created, auto-add creator as owner
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role) VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END; $$;
CREATE TRIGGER on_project_created AFTER INSERT ON public.projects FOR EACH ROW EXECUTE FUNCTION public.handle_new_project();

-- ======= RLS POLICIES =======

-- profiles
CREATE POLICY "Profiles: read own" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Profiles: read teammates" ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm1
    JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
    WHERE tm1.user_id = auth.uid() AND tm2.user_id = profiles.id
  ));
CREATE POLICY "Profiles: update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- user_roles
CREATE POLICY "Roles: read own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Roles: admin all" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- teams
CREATE POLICY "Teams: members read" ON public.teams FOR SELECT TO authenticated USING (public.is_team_member(auth.uid(), id));
CREATE POLICY "Teams: any auth create" ON public.teams FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Teams: owners update" ON public.teams FOR UPDATE TO authenticated
  USING (public.has_team_role(auth.uid(), id, 'owner') OR public.has_team_role(auth.uid(), id, 'admin'));
CREATE POLICY "Teams: owners delete" ON public.teams FOR DELETE TO authenticated USING (public.has_team_role(auth.uid(), id, 'owner'));

-- team_members
CREATE POLICY "TM: members read" ON public.team_members FOR SELECT TO authenticated USING (public.is_team_member(auth.uid(), team_id));
CREATE POLICY "TM: owners insert" ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (public.has_team_role(auth.uid(), team_id, 'owner') OR public.has_team_role(auth.uid(), team_id, 'admin'));
CREATE POLICY "TM: owners update" ON public.team_members FOR UPDATE TO authenticated
  USING (public.has_team_role(auth.uid(), team_id, 'owner') OR public.has_team_role(auth.uid(), team_id, 'admin'));
CREATE POLICY "TM: owners delete" ON public.team_members FOR DELETE TO authenticated
  USING (public.has_team_role(auth.uid(), team_id, 'owner') OR public.has_team_role(auth.uid(), team_id, 'admin'));

-- projects
CREATE POLICY "Projects: members read" ON public.projects FOR SELECT TO authenticated
  USING (public.is_project_member(auth.uid(), id) OR public.is_team_member(auth.uid(), team_id));
CREATE POLICY "Projects: team members create" ON public.projects FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by AND public.is_team_member(auth.uid(), team_id));
CREATE POLICY "Projects: editors update" ON public.projects FOR UPDATE TO authenticated
  USING (public.has_project_role(auth.uid(), id, ARRAY['owner','editor']::project_role[]));
CREATE POLICY "Projects: owners delete" ON public.projects FOR DELETE TO authenticated
  USING (public.has_project_role(auth.uid(), id, ARRAY['owner']::project_role[]));

-- project_members
CREATE POLICY "PM: members read" ON public.project_members FOR SELECT TO authenticated USING (public.is_project_member(auth.uid(), project_id));
CREATE POLICY "PM: owners insert" ON public.project_members FOR INSERT TO authenticated
  WITH CHECK (public.has_project_role(auth.uid(), project_id, ARRAY['owner']::project_role[]));
CREATE POLICY "PM: owners update" ON public.project_members FOR UPDATE TO authenticated
  USING (public.has_project_role(auth.uid(), project_id, ARRAY['owner']::project_role[]));
CREATE POLICY "PM: owners delete" ON public.project_members FOR DELETE TO authenticated
  USING (public.has_project_role(auth.uid(), project_id, ARRAY['owner']::project_role[]));