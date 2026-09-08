-- Migration 013: Convert servers.service_type from ENUM to TEXT
-- Allows arbitrary custom service types (e.g. 'Zabbix', 'Redis', 'Web Server')
-- instead of a restricted 8-value enum.
ALTER TABLE servers ALTER COLUMN service_type TYPE TEXT;

UPDATE servers SET service_type = 'Application' WHERE service_type = 'application';
UPDATE servers SET service_type = 'Database' WHERE service_type = 'database';
UPDATE servers SET service_type = 'Proxy' WHERE service_type = 'proxy';
UPDATE servers SET service_type = 'Monitoring' WHERE service_type = 'monitoring';
UPDATE servers SET service_type = 'Repository' WHERE service_type = 'repository';
UPDATE servers SET service_type = 'Metrics' WHERE service_type = 'metrics';
UPDATE servers SET service_type = 'Jump host' WHERE service_type = 'jump_host';
UPDATE servers SET service_type = 'Other' WHERE service_type = 'other';

DROP TYPE IF EXISTS service_type_enum;

CREATE INDEX IF NOT EXISTS idx_servers_service_type ON servers(service_type) WHERE deleted_at IS NULL;
