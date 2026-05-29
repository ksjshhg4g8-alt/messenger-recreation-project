import json
import os
import hashlib
import secrets
import urllib.request
import urllib.parse
import psycopg2

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

def _vk_exchange_code(code: str, device_id: str, code_verifier: str, redirect_uri: str):
    client_id = os.environ.get('VK_CLIENT_ID', '')
    if not client_id:
        return None, 'VK_CLIENT_ID не настроен'
    payload = urllib.parse.urlencode({
        'grant_type': 'authorization_code',
        'code': code,
        'code_verifier': code_verifier,
        'client_id': client_id,
        'device_id': device_id,
        'redirect_uri': redirect_uri,
    }).encode()
    req = urllib.request.Request(
        'https://id.vk.com/oauth2/auth',
        data=payload,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
            print('VK token response:', json.dumps(data))
            if 'access_token' not in data:
                return None, data.get('error_description') or data.get('error') or 'Ошибка VK ID'
            return data, None
    except Exception as e:
        print('VK exchange exception:', str(e))
        return None, f'Ошибка соединения с VK ID: {e}'

def _vk_get_user(access_token: str):
    client_id = os.environ.get('VK_CLIENT_ID', '')
    payload = urllib.parse.urlencode({
        'access_token': access_token,
        'client_id': client_id,
    }).encode()
    req = urllib.request.Request(
        'https://id.vk.com/oauth2/user_info',
        data=payload,
        headers={'Content-Type': 'application/x-www-form-urlencoded'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            data = json.loads(r.read().decode())
            print('VK user_info response:', json.dumps(data))
            return data.get('user'), None
    except Exception as e:
        print('VK user_info exception:', str(e))
        return None, f'Ошибка получения профиля VK: {e}'

def handler(event: dict, context) -> dict:
    '''
    Авторизация через VK ID (OAuth 2.1 PKCE).
    Действия: callback (обмен кода на токен и вход), me (получить профиль).
    '''
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors(), 'body': ''}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    if action == 'config':
        return _resp(200, {'client_id': os.environ.get('VK_CLIENT_ID', '')})

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()

    try:
        if action == 'callback':
            body = json.loads(event.get('body') or '{}')
            code = (body.get('code') or '').strip()
            device_id = (body.get('device_id') or '').strip()
            code_verifier = (body.get('code_verifier') or '').strip()
            redirect_uri = (body.get('redirect_uri') or '').strip()

            if not code or not device_id or not code_verifier:
                return _resp(400, {'error': 'Недостаточно данных для входа'})

            token_data, err = _vk_exchange_code(code, device_id, code_verifier, redirect_uri)
            if err:
                return _resp(400, {'error': err})

            vk_user, err = _vk_get_user(token_data['access_token'])
            if err or not vk_user:
                return _resp(400, {'error': err or 'Не удалось получить профиль VK'})

            vk_id = str(vk_user.get('user_id') or token_data.get('user_id') or '')
            first = vk_user.get('first_name') or ''
            last = vk_user.get('last_name') or ''
            display_name = (first + ' ' + last).strip() or f'VK {vk_id}'
            avatar = vk_user.get('avatar') or ''
            email = (vk_user.get('email') or '').strip().lower() or None

            if not vk_id:
                return _resp(400, {'error': 'VK не вернул идентификатор пользователя'})

            cur.execute("SELECT id, name, avatar_url FROM users WHERE vk_id = %s", (vk_id,))
            user = cur.fetchone()

            if user:
                user_id, user_name, db_avatar = user
                cur.execute(
                    "UPDATE users SET last_login_at = NOW(), avatar_url = COALESCE(NULLIF(%s, ''), avatar_url) WHERE id = %s",
                    (avatar, user_id)
                )
                avatar = avatar or db_avatar
            else:
                cur.execute(
                    "INSERT INTO users (vk_id, name, avatar_url, email, last_login_at) VALUES (%s, %s, %s, %s, NOW()) RETURNING id, name, avatar_url",
                    (vk_id, display_name, avatar, email)
                )
                user_id, user_name, avatar = cur.fetchone()

            token = _make_token(user_id)
            return _resp(200, {
                'ok': True,
                'token': token,
                'user': {'id': user_id, 'vk_id': vk_id, 'name': user_name, 'avatar_url': avatar}
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

            cur.execute("SELECT id, vk_id, name, avatar_url FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            if not row:
                return _resp(401, {'error': 'Не авторизован'})
            return _resp(200, {'user': {'id': row[0], 'vk_id': row[1], 'name': row[2], 'avatar_url': row[3]}})

        return _resp(400, {'error': 'Неизвестное действие'})
    finally:
        cur.close()
        conn.close()