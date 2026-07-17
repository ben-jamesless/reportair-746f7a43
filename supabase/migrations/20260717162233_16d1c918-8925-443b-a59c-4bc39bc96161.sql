
-- Phase 4 part 2: add "crew" project role — capture-only.
ALTER TYPE public.project_role ADD VALUE IF NOT EXISTS 'crew';
