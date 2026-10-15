-- Encrypted credentials for first-class integrations (e.g. the Jira API token).
-- Kept out of integration_settings, which stores plaintext JSON readable with
-- integrations.read. `credentials` is AES-256-GCM encrypted JSON.
CREATE TABLE IF NOT EXISTS integration_credentials (
  integration_id TEXT PRIMARY KEY,
  credentials    TEXT NOT NULL,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);
