export const DUTY_SCHEMA = `
CREATE TABLE IF NOT EXISTS duties (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  description         TEXT NOT NULL DEFAULT '',
  category            TEXT NOT NULL CHECK (category IN (
    'Inspection', 'Resident Feedback', 'Cleaning', 'Horticulture', 'Contractor', 'Maintenance', 'Admin', 'Other'
  )),
  duration_minutes    INTEGER NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440),
  deadline            TIMESTAMPTZ,
  location            TEXT NOT NULL DEFAULT '',
  share_location      BOOLEAN NOT NULL DEFAULT false,
  priority_factors    JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(priority_factors) = 'object'),
  remarks             TEXT NOT NULL DEFAULT '',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS duty_assignments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duty_id             UUID NOT NULL UNIQUE REFERENCES duties (id),
  team_id             UUID REFERENCES teams (id) ON DELETE SET NULL,
  officer_id          UUID NOT NULL REFERENCES users (id),
  assigned_by         UUID NOT NULL REFERENCES users (id),
  type                TEXT NOT NULL CHECK (type IN ('flexible', 'fixed')),
  start_at            TIMESTAMPTZ,
  end_at              TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  revision            INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (type = 'flexible' AND start_at IS NULL AND end_at IS NULL)
    OR (type = 'fixed' AND start_at IS NOT NULL AND end_at IS NOT NULL AND start_at < end_at)
  )
);

CREATE INDEX IF NOT EXISTS duty_assignments_team ON duty_assignments (team_id);
CREATE INDEX IF NOT EXISTS duty_assignments_officer ON duty_assignments (officer_id);
CREATE INDEX IF NOT EXISTS duty_assignments_fixed_range ON duty_assignments (start_at, end_at)
  WHERE type = 'fixed' AND cancelled_at IS NULL;

CREATE TABLE IF NOT EXISTS duty_assignment_history (
  id                  BIGSERIAL PRIMARY KEY,
  assignment_id       UUID NOT NULL REFERENCES duty_assignments (id),
  actor_id            UUID NOT NULL REFERENCES users (id),
  officer_id          UUID NOT NULL REFERENCES users (id),
  previous_officer_id UUID REFERENCES users (id),
  action              TEXT NOT NULL CHECK (action IN ('created', 'updated', 'cancelled')),
  revision            INTEGER NOT NULL,
  changed_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, revision)
);`
