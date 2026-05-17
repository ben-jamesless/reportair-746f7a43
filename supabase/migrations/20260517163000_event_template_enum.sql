-- Extend project_template enum with the 3 in-product event templates added in PR #4.
-- Frontend writes one of: 'blank', 'event_production', 'pop_up', 'exhibition', 'brand_activation'.
-- NewProjectDialog now persists `template` on insert (previously only localStorage held it).
--
-- The existing seed_event_production_albums trigger is intentionally unchanged —
-- it only fires for 'event_production', so the new templates have no DB-side side
-- effects beyond the value itself. Area/zone seeding stays in the frontend.
--
-- Postgres requires ADD VALUE statements to run outside a transaction. Each is
-- individually idempotent via IF NOT EXISTS so re-running the migration is safe.

ALTER TYPE public.project_template ADD VALUE IF NOT EXISTS 'pop_up';
ALTER TYPE public.project_template ADD VALUE IF NOT EXISTS 'exhibition';
ALTER TYPE public.project_template ADD VALUE IF NOT EXISTS 'brand_activation';
