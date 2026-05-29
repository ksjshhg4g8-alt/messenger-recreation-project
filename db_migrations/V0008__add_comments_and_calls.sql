-- Комментарии к публикациям
CREATE TABLE IF NOT EXISTS post_comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments(post_id, created_at);

-- Сигналинг WebRTC-звонков
CREATE TABLE IF NOT EXISTS calls (
    id SERIAL PRIMARY KEY,
    caller_id INTEGER NOT NULL REFERENCES users(id),
    callee_id INTEGER NOT NULL REFERENCES users(id),
    call_type VARCHAR(10) NOT NULL DEFAULT 'video',
    status VARCHAR(20) NOT NULL DEFAULT 'ringing',
    offer_sdp TEXT,
    answer_sdp TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_calls_callee ON calls(callee_id, status);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_id, status);

-- ICE-кандидаты для звонков
CREATE TABLE IF NOT EXISTS call_candidates (
    id SERIAL PRIMARY KEY,
    call_id INTEGER NOT NULL REFERENCES calls(id),
    sender_id INTEGER NOT NULL REFERENCES users(id),
    candidate TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_call_candidates_call ON call_candidates(call_id, id);