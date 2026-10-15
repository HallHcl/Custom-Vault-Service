-- Migration 015: Convert schedules.type from ENUM to TEXT
-- Allows arbitrary custom schedule types (e.g. 'Task', 'Issue', 'PM', 'MA')
-- instead of a restricted 3-value enum.
ALTER TABLE schedules ALTER COLUMN type TYPE TEXT;

UPDATE schedules SET type = 'Other' WHERE type = 'other';

DROP TYPE IF EXISTS schedule_type_enum;

CREATE INDEX IF NOT EXISTS idx_schedules_type ON schedules(type) WHERE deleted_at IS NULL;
