-- Секретный вопрос для восстановления пароля
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_question VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_answer_hash VARCHAR(255);