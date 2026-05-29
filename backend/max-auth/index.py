import json
import os
import hashlib
import secrets
import urllib.request
import urllib.parse
import psycopg2

MAX_API = 'https://platform-api.max.ru'

def _cors():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
        'Content-Type': 'application/json'
    }

def _resp(status, body):
    return {'statusCode': status, 'headers': _cors(), 'isBase64Encoded': False, 'body': json.dumps(body)}

def _make_token(user_id: int) -> str:
    raw = f'{user_id}:{secrets.token_hex(32)}'
    return hashlib.sha256(raw.encode()).hexdigest() + f':{user_id}'

def _hash_password(password: str, salt: str = None) -> str:
    if salt is None:
        salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 120000)
    return f'{salt}${dk.hex()}'

def _verify_password(password: str, stored: str) -> bool:
    if not stored or '$' not in stored:
        return False
    salt, _ = stored.split('$', 1)
    return secrets.compare_digest(_hash_password(password, salt), stored)

def _max_get(path: str):
    token = os.environ.get('MAX_BOT_TOKEN', '')
    req = urllib.request.Request(
        f'{MAX_API}{path}',
        headers={'Authorization': token, 'Content-Type': 'application/json'},
        method='GET'
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())

def _max_send_message(user_id: str, text: str):
    token = os.environ.get('MAX_BOT_TOKEN', '')
    payload = json.dumps({'text': text}).encode()
    url = f'{MAX_API}/messages?user_id={urllib.parse.quote(str(user_id))}'
    req = urllib.request.Request(
        url,
        data=payload,
        headers={'Authorization': token, 'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        print('MAX send_message error:', str(e))
        return None

def handler(event: dict, context) -> dict:
    '''
    Авторизация через мессенджер MAX по схеме бот + deep link.
    Действия: config, start, webhook, poll, register, login, me, recover-question, recover-reset.
    '''
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors(), 'body': ''}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    if action == 'config':
        return _resp(200, {
            'bot_username': os.environ.get('MAX_BOT_USERNAME', ''),
            'configured': bool(os.environ.get('MAX_BOT_TOKEN'))
        })

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()

    try:
        if action == 'start':
            if not os.environ.get('MAX_BOT_TOKEN'):
                return _resp(503, {'error': 'Вход через MAX ещё не настроен'})
            payload = secrets.token_urlsafe(24)
            cur.execute(
                "INSERT INTO max_auth_sessions (payload, status) VALUES (%s, 'pending')",
                (payload,)
            )
            bot = os.environ.get('MAX_BOT_USERNAME', '')
            link = f'https://max.ru/{bot}?start={payload}' if bot else ''
            return _resp(200, {'ok': True, 'payload': payload, 'link': link})

        if action == 'webhook':
            body = json.loads(event.get('body') or '{}')
            print('MAX webhook:', json.dumps(body))
            update_type = body.get('update_type') or body.get('type') or ''

            if update_type in ('bot_started', 'message_created'):
                start_payload = body.get('payload') or body.get('start_payload') or ''
                user = body.get('user') or {}
                if not user and body.get('message'):
                    user = (body['message'].get('sender') or {})
                    if not start_payload:
                        txt = (body['message'].get('body') or {}).get('text', '')
                        if txt.startswith('/start'):
                            start_payload = txt.replace('/start', '').strip()

                max_user_id = str(user.get('user_id') or user.get('id') or '')
                max_name = (user.get('name') or user.get('first_name') or '').strip()

                if start_payload and max_user_id:
                    cur.execute(
                        "SELECT id, status FROM max_auth_sessions WHERE payload = %s AND created_at > NOW() - INTERVAL '10 minutes'",
                        (start_payload,)
                    )
                    sess = cur.fetchone()
                    if sess and sess[1] == 'pending':
                        cur.execute("SELECT id, name FROM users WHERE max_user_id = %s", (max_user_id,))
                        u = cur.fetchone()
                        if u:
                            uid, uname = u
                            cur.execute("UPDATE users SET last_login_at = NOW() WHERE id = %s", (uid,))
                        else:
                            uname = max_name or f'MAX {max_user_id[-4:]}'
                            cur.execute(
                                "INSERT INTO users (max_user_id, name, last_login_at) VALUES (%s, %s, NOW()) RETURNING id",
                                (max_user_id, uname)
                            )
                            uid = cur.fetchone()[0]

                        token = _make_token(uid)
                        cur.execute(
                            "UPDATE max_auth_sessions SET status = 'confirmed', max_user_id = %s, max_name = %s, auth_token = %s, user_id = %s, confirmed_at = NOW() WHERE id = %s",
                            (max_user_id, max_name, token, uid, sess[0])
                        )
                        _max_send_message(max_user_id, 'Вход выполнен! Вернись на сайт — он откроется автоматически.')

            return _resp(200, {'ok': True})

        if action == 'poll':
            payload = params.get('payload', '')
            if not payload:
                return _resp(400, {'error': 'Нет идентификатора сессии'})
            cur.execute(
                "SELECT status, auth_token, user_id, max_user_id, max_name FROM max_auth_sessions WHERE payload = %s",
                (payload,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {'error': 'Сессия не найдена'})
            status, token, user_id, max_uid, max_name = row
            if status == 'confirmed':
                cur.execute("SELECT avatar_url FROM users WHERE id = %s", (user_id,))
                avatar = (cur.fetchone() or [None])[0]
                return _resp(200, {
                    'status': 'confirmed',
                    'token': token,
                    'user': {'id': user_id, 'max_user_id': max_uid, 'name': max_name, 'avatar_url': avatar}
                })
            return _resp(200, {'status': status})

        if action == 'register':
            body = json.loads(event.get('body') or '{}')
            login = (body.get('login') or '').strip()
            password = body.get('password') or ''
            name = (body.get('name') or '').strip()
            rec_question = (body.get('recovery_question') or '').strip()
            rec_answer = (body.get('recovery_answer') or '').strip()

            if len(login) < 3:
                return _resp(400, {'error': 'Логин минимум 3 символа'})
            if len(password) < 6:
                return _resp(400, {'error': 'Пароль минимум 6 символов'})

            cur.execute("SELECT id FROM users WHERE lower(login) = lower(%s)", (login,))
            if cur.fetchone():
                return _resp(409, {'error': 'Такой логин уже занят'})

            pwd_hash = _hash_password(password)
            display_name = name or login
            rec_answer_hash = _hash_password(rec_answer.lower()) if (rec_question and rec_answer) else None
            cur.execute(
                "INSERT INTO users (login, password_hash, name, recovery_question, recovery_answer_hash, last_login_at) VALUES (%s, %s, %s, %s, %s, NOW()) RETURNING id, name, avatar_url",
                (login, pwd_hash, display_name, rec_question or None, rec_answer_hash)
            )
            uid, uname, avatar = cur.fetchone()
            token = _make_token(uid)
            return _resp(200, {
                'ok': True,
                'token': token,
                'user': {'id': uid, 'login': login, 'name': uname, 'avatar_url': avatar}
            })

        if action == 'recover-question':
            body = json.loads(event.get('body') or '{}')
            login = (body.get('login') or '').strip()
            if not login:
                return _resp(400, {'error': 'Введите логин'})
            cur.execute(
                "SELECT recovery_question, recovery_answer_hash FROM users WHERE lower(login) = lower(%s)",
                (login,)
            )
            row = cur.fetchone()
            if not row or not row[0] or not row[1]:
                return _resp(404, {'error': 'Для этого логина восстановление недоступно'})
            return _resp(200, {'ok': True, 'question': row[0]})

        if action == 'recover-reset':
            body = json.loads(event.get('body') or '{}')
            login = (body.get('login') or '').strip()
            answer = (body.get('recovery_answer') or '').strip()
            new_password = body.get('new_password') or ''
            if len(new_password) < 6:
                return _resp(400, {'error': 'Новый пароль минимум 6 символов'})
            cur.execute(
                "SELECT id, name, avatar_url, recovery_answer_hash FROM users WHERE lower(login) = lower(%s)",
                (login,)
            )
            row = cur.fetchone()
            if not row or not row[3]:
                return _resp(404, {'error': 'Восстановление недоступно'})
            if not _verify_password(answer.lower(), row[3]):
                return _resp(401, {'error': 'Неверный ответ на секретный вопрос'})
            uid, uname, avatar, _ = row
            cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (_hash_password(new_password), uid))
            token = _make_token(uid)
            return _resp(200, {
                'ok': True,
                'token': token,
                'user': {'id': uid, 'login': login, 'name': uname, 'avatar_url': avatar}
            })

        if action == 'login':
            body = json.loads(event.get('body') or '{}')
            login = (body.get('login') or '').strip()
            password = body.get('password') or ''

            if not login or not password:
                return _resp(400, {'error': 'Введите логин и пароль'})

            cur.execute(
                "SELECT id, name, avatar_url, password_hash FROM users WHERE lower(login) = lower(%s)",
                (login,)
            )
            row = cur.fetchone()
            if not row or not _verify_password(password, row[3]):
                return _resp(401, {'error': 'Неверный логин или пароль'})

            uid, uname, avatar, _ = row
            cur.execute("UPDATE users SET last_login_at = NOW() WHERE id = %s", (uid,))
            token = _make_token(uid)
            return _resp(200, {
                'ok': True,
                'token': token,
                'user': {'id': uid, 'login': login, 'name': uname, 'avatar_url': avatar}
            })

        if action == 'me':
            headers = event.get('headers') or {}
            token = headers.get('X-Auth-Token') or headers.get('x-auth-token') or ''
            if ':' not in token:
                return _resp(401, {'error': 'Не авторизован'})
            try:
                user_id = int(token.rsplit(':', 1)[1])
            except Exception:
                return _resp(401, {'error': 'Не авторизован'})
            cur.execute("SELECT id, max_user_id, login, name, avatar_url FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            if not row:
                return _resp(401, {'error': 'Не авторизован'})
            return _resp(200, {'user': {'id': row[0], 'max_user_id': row[1], 'login': row[2], 'name': row[3], 'avatar_url': row[4]}})

        return _resp(400, {'error': 'Неизвестное действие'})
    finally:
        cur.close()
        conn.close()