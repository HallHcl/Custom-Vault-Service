ALTER TYPE entity_type_enum ADD VALUE IF NOT EXISTS 'resource_attachment';

CREATE TABLE resource_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  created_in_version_id UUID REFERENCES resource_versions(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  caption TEXT,
  uploaded_by UUID NOT NULL REFERENCES people(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_resource_attachments_resource ON resource_attachments(resource_id) WHERE deleted_at IS NULL;
