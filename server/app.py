"""
Локальный сервер для запуска cloud-функций на собственном хосте.

Каждая функция из /backend/<name>/index.py с handler(event, context)
становится доступной по адресу:  http://<host>:8000/<name>

Запуск:
    pip install -r server/requirements.txt
    uvicorn server.app:app --host 0.0.0.0 --port 8000

Перед запуском заполни переменные окружения (см. .env.example).
"""
import importlib.util
import json
import os
import sys
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"

app = FastAPI(title="Self-hosted backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class _Context:
    """Замена облачного context. У функций используется только context.request_id."""

    def __init__(self):
        self.request_id = os.urandom(8).hex()
        self.function_name = "local"
        self.memory_limit_in_mb = 512


def _load_handler(name: str):
    """Загружает handler из backend/<name>/index.py."""
    index_path = BACKEND_DIR / name / "index.py"
    if not index_path.exists():
        return None
    # Добавляем папку функции в путь, чтобы работали локальные импорты (models.py и т.п.)
    fn_dir = str(index_path.parent)
    if fn_dir not in sys.path:
        sys.path.insert(0, fn_dir)
    spec = importlib.util.spec_from_file_location(f"fn_{name}", index_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return getattr(module, "handler", None)


# Кэш загруженных функций
_HANDLERS: dict = {}


def _get_handler(name: str):
    if name not in _HANDLERS:
        _HANDLERS[name] = _load_handler(name)
    return _HANDLERS[name]


@app.get("/")
def root():
    fns = [p.name for p in BACKEND_DIR.iterdir() if (p / "index.py").exists()]
    return {"ok": True, "functions": fns}


@app.api_route(
    "/{name}",
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
)
async def call_function(name: str, request: Request):
    handler = _get_handler(name)
    if handler is None:
        return Response(
            content=json.dumps({"error": f"Функция '{name}' не найдена"}),
            status_code=404,
            media_type="application/json",
        )

    raw_body = await request.body()
    body_str = raw_body.decode("utf-8") if raw_body else ""

    # Прокси заголовков авторизации (как на проде): Authorization -> X-Authorization
    headers = {k: v for k, v in request.headers.items()}
    if "authorization" in headers:
        headers["X-Authorization"] = headers["authorization"]
    if "cookie" in headers:
        headers["X-Cookie"] = headers["cookie"]

    event = {
        "httpMethod": request.method,
        "headers": headers,
        "queryStringParameters": dict(request.query_params),
        "body": body_str,
        "isBase64Encoded": False,
        "requestContext": {
            "identity": {"sourceIp": request.client.host if request.client else ""}
        },
    }

    result = handler(event, _Context())

    status = result.get("statusCode", 200)
    resp_headers = result.get("headers", {}) or {}
    out_body = result.get("body", "")

    # X-Set-Cookie -> Set-Cookie (как делает прод-прокси)
    if "X-Set-Cookie" in resp_headers:
        resp_headers["Set-Cookie"] = resp_headers.pop("X-Set-Cookie")

    media_type = resp_headers.get("Content-Type", "application/json")

    return Response(
        content=out_body,
        status_code=status,
        headers=resp_headers,
        media_type=media_type,
    )
