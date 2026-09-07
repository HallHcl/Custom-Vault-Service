-- Dark Mode feature (approved backend-freeze exception). Per-account theme
-- preference for the manual light/dark toggle. Nullable with NO default:
-- NULL means "unset", which the application layer resolves to "light".
-- There is deliberately no 'system' value — this feature has no OS /
-- prefers-color-scheme auto-detection mode.
--
-- Same shape as 004_servers_access_fields.sql's ADD COLUMN statements:
-- a plain nullable column, no backfill (NULL is a valid, meaningful state),
-- run atomically by the migration runner (migrate.ts wraps each file in a
-- BEGIN/COMMIT).
ALTER TABLE users ADD COLUMN theme_preference TEXT
  CHECK (theme_preference IN ('light', 'dark'));
