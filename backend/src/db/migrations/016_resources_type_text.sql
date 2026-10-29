-- Migration 016: Convert resources.type from ENUM to TEXT
-- Allows arbitrary custom resource types (e.g. 'Docker', 'Certificate', 'Network')
-- instead of a restricted 7-value enum.
ALTER TABLE resources ALTER COLUMN type TYPE TEXT;

DROP TYPE IF EXISTS resource_type_enum;

DROP INDEX IF EXISTS idx_resources_type;
CREATE INDEX IF NOT EXISTS idx_resources_type ON resources(type) WHERE deleted_at IS NULL;

