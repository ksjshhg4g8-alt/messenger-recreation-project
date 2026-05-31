import json
import os
import psycopg2
import psycopg2.extras

def _cors():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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
    Управление чатами и сообщениями мессенджера.
    Действия: list-chats, get-messages, send-message, create-chat, search-users, mark-read, react, edit-message, delete-message.
    '''
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors(), 'body': ''}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')

    uid = _user_id(event)
    if not uid:
        return _resp(401, {'error': 'Не авторизован'})

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        if action == 'list-chats':
            cur.execute("""
                SELECT c.id, c.type, c.title, c.avatar_url, c.updated_at,
                    cm.last_read_message_id,
                    (SELECT m.text FROM messages m WHERE m.chat_id = c.id AND NOT m.removed ORDER BY m.id DESC LIMIT 1) AS last_text,
                    (SELECT m.type FROM messages m WHERE m.chat_id = c.id AND NOT m.removed ORDER BY m.id DESC LIMIT 1) AS last_type,
                    (SELECT m.created_at FROM messages m WHERE m.chat_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_time,
                    (SELECT m.id FROM messages m WHERE m.chat_id = c.id ORDER BY m.id DESC LIMIT 1) AS last_msg_id,
                    (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id AND m.id > cm.last_read_message_id AND m.sender_id != %s) AS unread
                FROM chats c
                JOIN chat_members cm ON cm.chat_id = c.id AND cm.user_id = %s
                ORDER BY c.updated_at DESC
            """, (uid, uid))
            chats = cur.fetchall()
            result = []
            for ch in chats:
                title = ch['title']
                avatar = ch['avatar_url']
                other_id = None
                online = False
                if ch['type'] == 'private':
                    cur.execute("""
                        SELECT u.id, u.name, u.avatar_url, u.is_online FROM chat_members cm
                        JOIN users u ON u.id = cm.user_id
                        WHERE cm.chat_id = %s AND cm.user_id != %s LIMIT 1
                    """, (ch['id'], uid))
                    other = cur.fetchone()
                    if other:
                        title = other['name']
                        avatar = other['avatar_url']
                        other_id = other['id']
                        online = other['is_online']
                result.append({
                    'id': ch['id'], 'type': ch['type'], 'title': title or 'Чат',
                    'avatar_url': avatar, 'other_id': other_id, 'online': online,
                    'last_text': ch['last_text'], 'last_type': ch['last_type'],
                    'last_time': ch['last_time'], 'unread': ch['unread']
                })
            return _resp(200, {'chats': result})

        if action == 'get-messages':
            chat_id = int(params.get('chat_id', 0))
            cur.execute("SELECT 1 FROM chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, uid))
            if not cur.fetchone():
                return _resp(403, {'error': 'Нет доступа'})
            cur.execute("""
                SELECT m.id, m.sender_id, m.type, m.text, m.media_url, m.media_meta,
                    m.reply_to, m.created_at, m.edited_at, u.name AS sender_name, u.avatar_url AS sender_avatar,
                    (SELECT rm.text FROM messages rm WHERE rm.id = m.reply_to) AS reply_text,
                    (SELECT rm.type FROM messages rm WHERE rm.id = m.reply_to) AS reply_type,
                    (SELECT ru.name FROM messages rm JOIN users ru ON ru.id = rm.sender_id WHERE rm.id = m.reply_to) AS reply_sender,
                    (SELECT json_agg(json_build_object('emoji', r.emoji, 'user_id', r.user_id)) FROM message_reactions r WHERE r.message_id = m.id) AS reactions,
                    (SELECT COUNT(*) FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id != m.sender_id) AS read_count
                FROM messages m
                JOIN users u ON u.id = m.sender_id
                WHERE m.chat_id = %s AND NOT m.removed
                ORDER BY m.id ASC LIMIT 200
            """, (chat_id,))
            msgs = cur.fetchall()
            return _resp(200, {'messages': msgs, 'me': uid})

        if action == 'send-message':
            body = json.loads(event.get('body') or '{}')
            chat_id = int(body.get('chat_id', 0))
            cur.execute("SELECT 1 FROM chat_members WHERE chat_id = %s AND user_id = %s", (chat_id, uid))
            if not cur.fetchone():
                return _resp(403, {'error': 'Нет доступа'})
            mtype = body.get('type', 'text')
            text = body.get('text')
            media_url = body.get('media_url')
            media_meta = json.dumps(body.get('media_meta')) if body.get('media_meta') else None
            reply_to = body.get('reply_to')
            cur.execute("""
                INSERT INTO messages (chat_id, sender_id, type, text, media_url, media_meta, reply_to)
                VALUES (%s, %s, %s, %s, %s, %s, %s) RETURNING id, created_at
            """, (chat_id, uid, mtype, text, media_url, media_meta, reply_to))
            row = cur.fetchone()
            cur.execute("UPDATE chats SET updated_at = NOW() WHERE id = %s", (chat_id,))
            cur.execute("UPDATE chat_members SET last_read_message_id = %s WHERE chat_id = %s AND user_id = %s", (row['id'], chat_id, uid))
            return _resp(200, {'id': row['id'], 'created_at': row['created_at']})

        if action == 'create-chat':
            body = json.loads(event.get('body') or '{}')
            ctype = body.get('type', 'private')
            if ctype == 'private':
                other = int(body.get('user_id', 0))
                cur.execute("""
                    SELECT c.id FROM chats c
                    JOIN chat_members m1 ON m1.chat_id = c.id AND m1.user_id = %s
                    JOIN chat_members m2 ON m2.chat_id = c.id AND m2.user_id = %s
                    WHERE c.type = 'private' LIMIT 1
                """, (uid, other))
                existing = cur.fetchone()
                if existing:
                    return _resp(200, {'chat_id': existing['id'], 'existing': True})
                cur.execute("INSERT INTO chats (type, created_by) VALUES ('private', %s) RETURNING id", (uid,))
                chat_id = cur.fetchone()['id']
                cur.execute("INSERT INTO chat_members (chat_id, user_id) VALUES (%s, %s), (%s, %s)", (chat_id, uid, chat_id, other))
                return _resp(200, {'chat_id': chat_id, 'existing': False})
            else:
                title = body.get('title', 'Новая группа')
                members = body.get('members', [])
                cur.execute("INSERT INTO chats (type, title, created_by) VALUES ('group', %s, %s) RETURNING id", (title, uid))
                chat_id = cur.fetchone()['id']
                cur.execute("INSERT INTO chat_members (chat_id, user_id, role) VALUES (%s, %s, 'admin')", (chat_id, uid))
                for m in members:
                    cur.execute("INSERT INTO chat_members (chat_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING", (chat_id, int(m)))
                return _resp(200, {'chat_id': chat_id, 'existing': False})

        if action == 'search-users':
            q = (params.get('q') or '').strip()
            cur.execute("""
                SELECT id, name, phone, avatar_url FROM users
                WHERE id != %s AND (name ILIKE %s OR phone ILIKE %s) LIMIT 20
            """, (uid, f'%{q}%', f'%{q}%'))
            return _resp(200, {'users': cur.fetchall()})

        if action == 'mark-read':
            body = json.loads(event.get('body') or '{}')
            chat_id = int(body.get('chat_id', 0))
            last_id = int(body.get('last_message_id', 0))
            cur.execute("UPDATE chat_members SET last_read_message_id = %s WHERE chat_id = %s AND user_id = %s AND last_read_message_id < %s", (last_id, chat_id, uid, last_id))
            cur.execute("""
                INSERT INTO message_reads (message_id, user_id)
                SELECT id, %s FROM messages WHERE chat_id = %s AND id <= %s AND sender_id != %s
                ON CONFLICT DO NOTHING
            """, (uid, chat_id, last_id, uid))
            return _resp(200, {'ok': True})

        if action == 'react':
            body = json.loads(event.get('body') or '{}')
            msg_id = int(body.get('message_id', 0))
            emoji = body.get('emoji', '')
            if not emoji:
                cur.execute("DELETE FROM message_reactions WHERE message_id = %s AND user_id = %s", (msg_id, uid))
            else:
                cur.execute("""
                    INSERT INTO message_reactions (message_id, user_id, emoji) VALUES (%s, %s, %s)
                    ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji
                """, (msg_id, uid, emoji))
            return _resp(200, {'ok': True})

        if action == 'edit-message':
            body = json.loads(event.get('body') or '{}')
            msg_id = int(body.get('message_id', 0))
            text = (body.get('text') or '').strip()
            if not text:
                return _resp(400, {'error': 'Пустой текст'})
            cur.execute("SELECT sender_id, type FROM messages WHERE id = %s AND NOT removed", (msg_id,))
            row = cur.fetchone()
            if not row:
                return _resp(404, {'error': 'Сообщение не найдено'})
            if row['sender_id'] != uid:
                return _resp(403, {'error': 'Можно редактировать только свои сообщения'})
            if row['type'] != 'text':
                return _resp(400, {'error': 'Редактировать можно только текст'})
            cur.execute("UPDATE messages SET text = %s, edited_at = NOW() WHERE id = %s", (text, msg_id))
            return _resp(200, {'ok': True})

        if action == 'delete-message':
            body = json.loads(event.get('body') or '{}')
            msg_id = int(body.get('message_id', 0))
            cur.execute("SELECT sender_id FROM messages WHERE id = %s", (msg_id,))
            row = cur.fetchone()
            if not row:
                return _resp(404, {'error': 'Сообщение не найдено'})
            if row['sender_id'] != uid:
                return _resp(403, {'error': 'Можно удалять только свои сообщения'})
            cur.execute("UPDATE messages SET removed = TRUE WHERE id = %s", (msg_id,))
            return _resp(200, {'ok': True})

        return _resp(400, {'error': 'Неизвестное действие'})
    finally:
        cur.close()
        conn.close()