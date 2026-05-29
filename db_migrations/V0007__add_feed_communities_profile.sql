-- Профиль и статус пользователя
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status_text VARCHAR(100);

-- Лента публикаций
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    text TEXT,
    media_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user ON posts(user_id);

CREATE TABLE IF NOT EXISTS post_likes (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);

-- Сообщества: группы и каналы
CREATE TABLE IF NOT EXISTS communities (
    id SERIAL PRIMARY KEY,
    type VARCHAR(20) NOT NULL DEFAULT 'group',
    title VARCHAR(120) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_communities_type ON communities(type);

CREATE TABLE IF NOT EXISTS community_members (
    id SERIAL PRIMARY KEY,
    community_id INTEGER NOT NULL REFERENCES communities(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(community_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_community_members_comm ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);