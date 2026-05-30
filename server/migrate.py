"""
Применяет все SQL-миграции из папки db_migrations/ к базе данных по порядку.

Запуск:
    pip install psycopg2-binary
    export DATABASE_URL="postgresql://user:password@host:5432/dbname"
    python server/migrate.py

Миграции написаны с CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS,
поэтому повторный запуск безопасен.
"""
import os
import sys
from pathlib import Path

import psycopg2

MIGRATIONS_DIR = Path(__file__).resolve().parent.parent / "db_migrations"


def main():
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("Ошибка: не задана переменная окружения DATABASE_URL")
        sys.exit(1)

    files = sorted(MIGRATIONS_DIR.glob("V*.sql"))
    if not files:
        print(f"Не найдено миграций в {MIGRATIONS_DIR}")
        sys.exit(1)

    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()

    for f in files:
        sql = f.read_text(encoding="utf-8")
        print(f"-> Применяю {f.name} ...")
        try:
            cur.execute(sql)
        except Exception as e:
            print(f"   Ошибка в {f.name}: {e}")
            sys.exit(1)

    cur.close()
    conn.close()
    print(f"Готово. Применено миграций: {len(files)}")


if __name__ == "__main__":
    main()
