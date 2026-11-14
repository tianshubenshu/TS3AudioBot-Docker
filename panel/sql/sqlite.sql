PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY, username TEXT NOT NULL COLLATE NOCASE UNIQUE, password_hash TEXT,
 role TEXT NOT NULL DEFAULT 'user', created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 last_login_at TEXT, suspended INTEGER NOT NULL DEFAULT 0, bot_limit INTEGER, can_create_bots INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (
 id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf_token TEXT NOT NULL,
 flash_type TEXT, flash_message TEXT, expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS instances (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, base_url TEXT NOT NULL, owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 api_user TEXT, api_token_enc TEXT, enabled INTEGER NOT NULL DEFAULT 1, notes TEXT,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS ts_bots (
 id INTEGER PRIMARY KEY, instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE, name TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 assignee_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL, label TEXT, template TEXT,
 connect_nickname TEXT, connect_channel TEXT, connect_bitrate INTEGER, connect_volume INTEGER, connect_run INTEGER,
 connect_startup TEXT, connect_server_password INTEGER NOT NULL DEFAULT 0, connect_channel_password INTEGER NOT NULL DEFAULT 0,
 connect_address TEXT, UNIQUE(instance_id,template)
);
CREATE TABLE IF NOT EXISTS instance_grants (
 instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, can_control INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), PRIMARY KEY(instance_id,user_id)
);
CREATE TABLE IF NOT EXISTS radio_streams (
 id INTEGER PRIMARY KEY, name TEXT NOT NULL, url TEXT NOT NULL, notes TEXT, shared INTEGER NOT NULL DEFAULT 0,
 owner_user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
 updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), UNIQUE(owner_user_id,url)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_radio_shared_url ON radio_streams(url) WHERE shared = 1;
CREATE INDEX IF NOT EXISTS idx_radio_name ON radio_streams(name);
CREATE TABLE IF NOT EXISTS audit_log (
 id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 bot_id INTEGER REFERENCES ts_bots(id) ON DELETE SET NULL, instance_id INTEGER REFERENCES instances(id) ON DELETE SET NULL,
 action TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
CREATE TABLE IF NOT EXISTS invite_tokens (
 id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, label TEXT, created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
 created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')), expires_at TEXT,
 max_uses INTEGER NOT NULL DEFAULT 1 CHECK(max_uses >= 1), use_count INTEGER NOT NULL DEFAULT 0,
 revoked_at TEXT, can_create_bots INTEGER NOT NULL DEFAULT 0, bot_limit INTEGER
);
CREATE TABLE IF NOT EXISTS invite_token_instances (
 token_id INTEGER NOT NULL REFERENCES invite_tokens(id) ON DELETE CASCADE,
 instance_id INTEGER NOT NULL REFERENCES instances(id) ON DELETE CASCADE, PRIMARY KEY(token_id,instance_id)
);
