-- ─────────────────────────────────────────────────────────────────────────────
-- ReportAir: Plan rename migration
-- free       → solo
-- pro        → pro        (unchanged — already correct)
-- team       → pro        (old "team" maps to new "pro")
-- enterprise → studio
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. Rename existing enum values (Postgres 14+)
--    If your enum type is named differently, adjust accordingly.
--    If no enum type exists and plan is a plain TEXT column, skip to step 2.

DO $$
BEGIN
  -- Only attempt if a plan_type enum exists
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'plan_type'
  ) THEN
    -- Rename old values to new names
    ALTER TYPE plan_type RENAME VALUE 'free'       TO 'solo'   WHERE EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'free'       AND enumtypid = 'plan_type'::regtype);
    ALTER TYPE plan_type RENAME VALUE 'enterprise' TO 'studio' WHERE EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'enterprise' AND enumtypid = 'plan_type'::regtype);
    -- Add 'studio' if not already present
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'studio' AND enumtypid = 'plan_type'::regtype) THEN
      ALTER TYPE plan_type ADD VALUE 'studio';
    END IF;
  END IF;
END$$;

-- 2. Remap data rows (works for both TEXT and enum columns)
UPDATE teams SET plan = 'solo'   WHERE plan = 'free';
UPDATE teams SET plan = 'studio' WHERE plan = 'enterprise';
-- 'team' → 'pro' (old team tier maps to new pro tier)
UPDATE teams SET plan = 'pro'    WHERE plan = 'team';

-- 3. Update column default
ALTER TABLE teams ALTER COLUMN plan SET DEFAULT 'solo';

-- 4. Add CHECK constraint if column is plain TEXT (safe to run even if one exists —
--    the DO block checks first)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'teams' AND constraint_name = 'teams_plan_check'
  ) THEN
    ALTER TABLE teams ADD CONSTRAINT teams_plan_check
      CHECK (plan IN ('solo', 'pro', 'studio'));
  ELSE
    -- Drop and recreate to include new values
    ALTER TABLE teams DROP CONSTRAINT teams_plan_check;
    ALTER TABLE teams ADD CONSTRAINT teams_plan_check
      CHECK (plan IN ('solo', 'pro', 'studio'));
  END IF;
END$$;

COMMIT;
