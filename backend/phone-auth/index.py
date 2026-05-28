import json
import os
import re
import hashlib
import secrets
import random
from datetime import datetime, timedelta
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

def _normalize_phone(raw: str) -> str:
    digits = re.sub(r'\D', '', raw or '')
    if digits.startswith('8') and len(digits) == 11:
        digits = '7' + digits[1:]
    if len(digits) == 10:
        digits = '7' + digits
    return digits

def _send_sms(phone: str, code: str) -> bool:
    api_id = os.environ.get('SMSRU_API_ID', '')
    if not api_id:
        return False
    params = urllib.parse.urlencode({
        'api_id': api_id,
        'to': phone,
        'msg': f'Код для входа: {code}',
        'json': 1
    })
    url = f'https://sms.ru/sms/send?{params}'
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            data = json.loads(r.read().decode())
            return data.get('status') == 'OK'
    except Exception:
        return False

def _make_token(user_id: int) -> str:
    raw = f'{user_id}:{secrets.token_hex(32)}'
    return hashlib.sha256(raw.encode()).hexdigest() + f':{user_id}'

def handler(event: dict, context) -> dict:
    '''
    Авторизация по номеру телефона через SMS.ru.
    Действия: send-code (отправить код), verify-code (подтвердить и войти), me (получить профиль).
    '''
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors(), 'body': ''}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()

    try:
        if action == 'send-code':
            body = json.loads(event.get('body') or '{}')
            phone = _normalize_phone(body.get('phone', ''))
            if len(phone) != 11 or not phone.startswith('7'):
                return _resp(400, {'error': 'Некорректный номер телефона'})

            cur.execute(
                "SELECT COUNT(*) FROM sms_codes WHERE phone = %s AND created_at > NOW() - INTERVAL '1 minute'",
                (phone,)
            )
            if cur.fetchone()[0] > 0:
                return _resp(429, {'error': 'Подождите минуту перед повторной отправкой'})

            code = f'{random.randint(0, 999999):06d}'
            expires = datetime.utcnow() + timedelta(minutes=5)
            cur.execute(
                "INSERT INTO sms_codes (phone, code, expires_at) VALUES (%s, %s, %s)",
                (phone, code, expires)
            )

            sent = _send_sms(phone, code)
            if not sent:
                return _resp(500, {'error': 'Не удалось отправить SMS. Проверьте баланс SMS.ru'})

            return _resp(200, {'ok': True, 'phone': phone})

        if action == 'verify-code':
            body = json.loads(event.get('body') or '{}')
            phone = _normalize_phone(body.get('phone', ''))
            code = (body.get('code') or '').strip()
            name = (body.get('name') or '').strip()

            if not phone or not code:
                return _resp(400, {'error': 'Введите телефон и код'})

            cur.execute(
                "SELECT id, code, attempts FROM sms_codes WHERE phone = %s AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1",
                (phone,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(400, {'error': 'Код истёк или не запрошен'})

            sms_id, real_code, attempts = row
            if attempts >= 5:
                return _resp(429, {'error': 'Слишком много попыток'})

            if code != real_code:
                cur.execute("UPDATE sms_codes SET attempts = attempts + 1 WHERE id = %s", (sms_id,))
                return _resp(400, {'error': 'Неверный код'})

            cur.execute("UPDATE sms_codes SET used = TRUE WHERE id = %s", (sms_id,))

            cur.execute("SELECT id, name, avatar_url FROM users WHERE phone = %s", (phone,))
            user = cur.fetchone()

            if user:
                user_id, user_name, avatar = user
                cur.execute("UPDATE users SET last_login_at = NOW() WHERE id = %s", (user_id,))
            else:
                display_name = name or f'Гость {phone[-4:]}'
                cur.execute(
                    "INSERT INTO users (phone, name, phone_verified, last_login_at) VALUES (%s, %s, TRUE, NOW()) RETURNING id, name, avatar_url",
                    (phone, display_name)
                )
                user_id, user_name, avatar = cur.fetchone()

            token = _make_token(user_id)
            return _resp(200, {
                'ok': True,
                'token': token,
                'user': {'id': user_id, 'phone': phone, 'name': user_name, 'avatar_url': avatar}
            })

        if action == 'me':
            token = (event.get('headers') or {}).get('X-Auth-Token') or (event.get('headers') or {}).get('x-auth-token') or ''
            if ':' not in token:
                return _resp(401, {'error': 'Не авторизован'})
            try:
                user_id = int(token.rsplit(':', 1)[1])
            except Exception:
                return _resp(401, {'error': 'Не авторизован'})

            cur.execute("SELECT id, phone, name, avatar_url FROM users WHERE id = %s", (user_id,))
            row = cur.fetchone()
            if not row:
                return _resp(401, {'error': 'Не авторизован'})
            return _resp(200, {'user': {'id': row[0], 'phone': row[1], 'name': row[2], 'avatar_url': row[3]}})

        return _resp(400, {'error': 'Неизвестное действие'})
    finally:
        cur.close()
        conn.close()
