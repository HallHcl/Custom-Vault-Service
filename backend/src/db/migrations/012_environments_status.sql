-- Environment support/lifecycle status. This is the vendor-side phase the
-- environment is in (build -> warranty -> steady-state operation -> retired),
-- distinct from schedule_type_enum's PM/MA, which are recurring maintenance
-- *activities* logged in `schedules`, not a state an environment sits in.
--
-- Kept as TEXT + CHECK (not a PG enum) to match how projects.owner_status /
-- clients.status are modelled, and so the allowed set can be widened later
-- without an `ALTER TYPE`. Existing rows backfill to 'implementation'.
ALTER TABLE environments
  ADD COLUMN status TEXT NOT NULL DEFAULT 'implementation'
  CHECK (status IN ('implementation', 'warranty', 'in_operation', 'on_hold', 'decommissioned'));

CREATE INDEX idx_environments_status ON environments(status) WHERE deleted_at IS NULL;
