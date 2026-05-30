# Сервер функций (Python + FastAPI)
FROM python:3.11-slim

WORKDIR /app

# Зависимости сервера
COPY server/requirements.txt /app/server/requirements.txt
RUN pip install --no-cache-dir -r /app/server/requirements.txt

# Код функций и сервера
COPY backend /app/backend
COPY server /app/server
COPY db_migrations /app/db_migrations

EXPOSE 8000

# migrate.py создаёт таблицы, затем стартует сервер
CMD ["sh", "-c", "python server/migrate.py && uvicorn server.app:app --host 0.0.0.0 --port 8000"]
