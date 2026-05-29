CREATE TABLE IF NOT EXISTS max_auth_sessions (
    id SERIAL PRIMARY KEY,
    payload VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    max_user_id VARCHAR(64),
    max_name VARCHAR(255),
    auth_token TEXT,
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    confirmed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_max_sessions_payload ON max_auth_sessions(payload);
CREATE INDEX IF NOT EXISTS idx_max_sessions_created ON max_auth_sessions(created_at);

ALTER TABLE users ADD COLUMN IF NOT EXISTS max_user_id VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_max_user_id ON users(max_user_id) WHERE max_user_id IS NOT NULL;