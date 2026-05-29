import json
import os
import psycopg2
import psycopg2.extras

def _cors():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
        'Content-Type': 'application/json'
    }

def _resp(status, body):
    return {'statusCode': status, 'headers': _cors(), 'isBase64Encoded': False, 'body': json.dumps(body, default=str)}

def _user_id(event):
    headers = event.get('headers') or {}
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token') or ''
    if ':' not in token:
        return None
    try:
        return int(token.rsplit(':', 1)[1])
    except Exception:
        return None

def handler(event: dict, context) -> dict:
    '''
    Истории (статусы) пользователей: создание, просмотр списка, отметка просмотра.
    Истории живут 24 часа.
    '''
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors(), 'body': ''}

    uid = _user_id(event)
    if not uid:
        return _resp(401, {'error': 'Не авторизован'})

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        if action == 'list':
            cur.execute("""
                SELECT s.user_id, u.name, u.avatar_url,
                    COUNT(*) AS count,
                    MAX(s.created_at) AS latest,
                    bool_and(EXISTS(SELECT 1 FROM story_views v WHERE v.story_id = s.id AND v.user_id = %s)) AS all_viewed
                FROM stories s
                JOIN users u ON u.id = s.user_id
                WHERE s.expires_at > NOW()
                GROUP BY s.user_id, u.name, u.avatar_url
                ORDER BY (s.user_id = %s) DESC, latest DESC
            """, (uid, uid))
            return _resp(200, {'stories': cur.fetchall(), 'me': uid})

        if action == 'user-stories':
            target = int(params.get('user_id', 0))
            cur.execute("""
                SELECT id, type, media_url, caption, bg_color, created_at
                FROM stories WHERE user_id = %s AND expires_at > NOW()
                ORDER BY created_at ASC
            """, (target,))
            return _resp(200, {'items': cur.fetchall()})

        if action == 'create':
            body = json.loads(event.get('body') or '{}')
            cur.execute("""
                INSERT INTO stories (user_id, type, media_url, caption, bg_color, expires_at)
                VALUES (%s, %s, %s, %s, %s, NOW() + INTERVAL '24 hours') RETURNING id
            """, (uid, body.get('type', 'image'), body.get('media_url'), body.get('caption'), body.get('bg_color')))
            return _resp(200, {'id': cur.fetchone()['id']})

        if action == 'view':
            body = json.loads(event.get('body') or '{}')
            cur.execute("INSERT INTO story_views (story_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (int(body.get('story_id', 0)), uid))
            return _resp(200, {'ok': True})

        return _resp(400, {'error': 'Неизвестное действие'})
    finally:
        cur.close()
        conn.close()
