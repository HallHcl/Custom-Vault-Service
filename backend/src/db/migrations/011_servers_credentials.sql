-- Simplified "New server" form (Part: server quick-add) captures a login pair
-- directly on the server row: username is typically a shell/RDP account such as
-- `root`, password is stored as-is. This is deliberately plaintext — the app has
-- no credential encryption yet, and this is an internal inventory tool. Anything
-- needing real secret handling still belongs in credential_references.
ALTER TABLE servers ADD COLUMN username TEXT;
ALTER TABLE servers ADD COLUMN password TEXT;
