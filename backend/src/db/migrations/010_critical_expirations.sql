ALTER TYPE entity_type_enum ADD VALUE IF NOT EXISTS 'expiration';

CREATE TYPE expiration_type_enum AS ENUM (
  'ssl_certificate', 'hardware_ma', 'software_license',
  'warranty', 'domain_or_cloud'
);

CREATE TYPE expiration_status_enum AS ENUM ('active', 'renewed', 'expired');

CREATE TABLE expirations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  server_id UUID REFERENCES servers(id) ON DELETE SET NULL,
  type expiration_type_enum NOT NULL,
  name TEXT NOT NULL,
  provider_or_vendor TEXT,
  identifier TEXT,
  expiry_date DATE NOT NULL,
  alert_threshold_days INT NOT NULL DEFAULT 30,
  status expiration_status_enum NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_expirations_client ON expirations(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expirations_project ON expirations(project_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expirations_server ON expirations(server_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_expirations_expiry_date ON expirations(expiry_date) WHERE deleted_at IS NULL;
CREATE INDEX idx_expirations_status ON expirations(status) WHERE deleted_at IS NULL;
