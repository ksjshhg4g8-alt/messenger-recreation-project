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

def _uid_from_token(event):
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
    Социальные функции: лента публикаций, группы/каналы, статусы онлайн, профиль пользователя.
    Действия: feed-list, video-feed, feed-create, feed-like, comments-list, comment-add, comment-delete,
    communities-list, community-create, community-join, community-leave, community-detail,
    community-posts, community-post-create, community-post-delete, block-toggle, blocks-list,
    status-ping, profile-get, profile-update,
    call-start, call-incoming, call-answer, call-poll, call-end, call-ice-add, call-ice-get.
    '''
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors(), 'body': ''}

    params = event.get('queryStringParameters') or {}
    action = params.get('action', '')
    uid = _uid_from_token(event)
    if not uid:
        return _resp(401, {'error': 'Не авторизован'})

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # обновляем онлайн при любом запросе
        cur.execute("UPDATE users SET is_online = TRUE, last_seen_at = NOW() WHERE id = %s", (uid,))

        if action == 'status-ping':
            return _resp(200, {'ok': True})

        if action in ('feed-list', 'video-feed'):
            only_video = action == 'video-feed'
            where = "WHERE p.media_url ILIKE '%%.mp4' OR p.media_url ILIKE '%%.webm' OR p.media_url ILIKE '%%.mov'" if only_video else ""
            cur.execute(
                f"""
                SELECT p.id, p.text, p.media_url, p.created_at,
                       u.id AS author_id, u.name AS author_name, u.avatar_url AS author_avatar,
                       (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
                       (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comments,
                       EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = %s) AS liked
                FROM posts p
                JOIN users u ON u.id = p.user_id
                {where}
                ORDER BY p.created_at DESC
                LIMIT 100
                """,
                (uid,)
            )
            return _resp(200, {'posts': cur.fetchall(), 'me': uid})

        if action == 'comments-list':
            post_id = int(params.get('post_id', 0))
            cur.execute(
                """
                SELECT c.id, c.text, c.created_at,
                       u.id AS author_id, u.name AS author_name, u.avatar_url AS author_avatar
                FROM post_comments c JOIN users u ON u.id = c.user_id
                WHERE c.post_id = %s ORDER BY c.created_at ASC LIMIT 200
                """,
                (post_id,)
            )
            return _resp(200, {'comments': cur.fetchall(), 'me': uid})

        if action == 'comment-add':
            body = json.loads(event.get('body') or '{}')
            post_id = body.get('post_id')
            text = (body.get('text') or '').strip()
            if not post_id or not text:
                return _resp(400, {'error': 'Пустой комментарий'})
            cur.execute(
                "INSERT INTO post_comments (post_id, user_id, text) VALUES (%s, %s, %s) RETURNING id, created_at",
                (post_id, uid, text)
            )
            row = cur.fetchone()
            return _resp(200, {'id': row['id'], 'created_at': row['created_at']})

        if action == 'comment-delete':
            body = json.loads(event.get('body') or '{}')
            cid = int(body.get('comment_id', 0))
            cur.execute("SELECT user_id FROM post_comments WHERE id = %s", (cid,))
            row = cur.fetchone()
            if not row:
                return _resp(404, {'error': 'Комментарий не найден'})
            if row['user_id'] != uid:
                return _resp(403, {'error': 'Можно удалять только свои комментарии'})
            cur.execute("DELETE FROM post_comments WHERE id = %s", (cid,))
            return _resp(200, {'ok': True})

        if action == 'feed-create':
            body = json.loads(event.get('body') or '{}')
            text = (body.get('text') or '').strip()
            media_url = (body.get('media_url') or '').strip() or None
            if not text and not media_url:
                return _resp(400, {'error': 'Пустая публикация'})
            cur.execute(
                "INSERT INTO posts (user_id, text, media_url) VALUES (%s, %s, %s) RETURNING id, created_at",
                (uid, text or None, media_url)
            )
            row = cur.fetchone()
            return _resp(200, {'id': row['id'], 'created_at': row['created_at']})

        if action == 'feed-like':
            body = json.loads(event.get('body') or '{}')
            post_id = body.get('post_id')
            if not post_id:
                return _resp(400, {'error': 'Нет публикации'})
            cur.execute("SELECT 1 FROM post_likes WHERE post_id = %s AND user_id = %s", (post_id, uid))
            if cur.fetchone():
                cur.execute("DELETE FROM post_likes WHERE post_id = %s AND user_id = %s", (post_id, uid))
                liked = False
            else:
                cur.execute("INSERT INTO post_likes (post_id, user_id) VALUES (%s, %s)", (post_id, uid))
                liked = True
            cur.execute("SELECT COUNT(*) AS c FROM post_likes WHERE post_id = %s", (post_id,))
            return _resp(200, {'liked': liked, 'likes': cur.fetchone()['c']})

        if action == 'communities-list':
            ctype = params.get('type', '')
            where = "WHERE c.type = %s" if ctype in ('group', 'channel') else ""
            args = (uid,) + ((ctype,) if where else ())
            cur.execute(
                f"""
                SELECT c.id, c.type, c.title, c.description, c.avatar_url, c.owner_id,
                       (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id) AS members,
                       EXISTS(SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = %s) AS joined
                FROM communities c
                {where}
                ORDER BY members DESC, c.created_at DESC
                LIMIT 100
                """,
                args
            )
            return _resp(200, {'communities': cur.fetchall()})

        if action == 'community-create':
            body = json.loads(event.get('body') or '{}')
            title = (body.get('title') or '').strip()
            ctype = body.get('type') if body.get('type') in ('group', 'channel') else 'group'
            description = (body.get('description') or '').strip() or None
            avatar_url = (body.get('avatar_url') or '').strip() or None
            if len(title) < 2:
                return _resp(400, {'error': 'Название минимум 2 символа'})
            cur.execute(
                "INSERT INTO communities (type, title, description, avatar_url, owner_id) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                (ctype, title, description, avatar_url, uid)
            )
            cid = cur.fetchone()['id']
            cur.execute("INSERT INTO community_members (community_id, user_id) VALUES (%s, %s)", (cid, uid))
            return _resp(200, {'id': cid})

        if action == 'community-join':
            body = json.loads(event.get('body') or '{}')
            cid = body.get('community_id')
            cur.execute(
                "INSERT INTO community_members (community_id, user_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (cid, uid)
            )
            return _resp(200, {'ok': True, 'joined': True})

        if action == 'community-leave':
            body = json.loads(event.get('body') or '{}')
            cid = body.get('community_id')
            cur.execute("DELETE FROM community_members WHERE community_id = %s AND user_id = %s", (cid, uid))
            return _resp(200, {'ok': True, 'joined': False})

        if action == 'community-detail':
            cid = params.get('id')
            cur.execute(
                """
                SELECT c.id, c.type, c.title, c.description, c.avatar_url, c.owner_id, c.created_at,
                       (SELECT COUNT(*) FROM community_members cm WHERE cm.community_id = c.id) AS members,
                       EXISTS(SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = %s) AS joined
                FROM communities c WHERE c.id = %s
                """,
                (uid, cid)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {'error': 'Сообщество не найдено'})
            return _resp(200, {'community': row})

        if action == 'profile-get':
            target = params.get('user_id') or uid
            cur.execute(
                """
                SELECT id, name, login, avatar_url, bio, status_text, is_online, last_seen_at,
                       (SELECT COUNT(*) FROM posts p WHERE p.user_id = users.id) AS posts_count
                FROM users WHERE id = %s
                """,
                (target,)
            )
            user = cur.fetchone()
            if not user:
                return _resp(404, {'error': 'Пользователь не найден'})
            cur.execute(
                """
                SELECT p.id, p.text, p.media_url, p.created_at,
                       (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
                       EXISTS(SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.user_id = %s) AS liked
                FROM posts p WHERE p.user_id = %s ORDER BY p.created_at DESC LIMIT 50
                """,
                (uid, target)
            )
            posts = cur.fetchall()
            cur.execute("SELECT 1 FROM user_blocks WHERE blocker_id = %s AND blocked_id = %s", (uid, target))
            is_blocked = bool(cur.fetchone())
            return _resp(200, {'user': user, 'posts': posts, 'is_me': int(target) == uid, 'is_blocked': is_blocked})

        if action == 'profile-update':
            body = json.loads(event.get('body') or '{}')
            name = (body.get('name') or '').strip()
            bio = (body.get('bio') or '').strip()
            status_text = (body.get('status_text') or '').strip()
            avatar_url = (body.get('avatar_url') or '').strip()
            sets, args = [], []
            if name:
                sets.append("name = %s"); args.append(name)
            if 'bio' in body:
                sets.append("bio = %s"); args.append(bio or None)
            if 'status_text' in body:
                sets.append("status_text = %s"); args.append(status_text or None)
            if avatar_url:
                sets.append("avatar_url = %s"); args.append(avatar_url)
            if not sets:
                return _resp(400, {'error': 'Нет данных для обновления'})
            args.append(uid)
            cur.execute(f"UPDATE users SET {', '.join(sets)} WHERE id = %s RETURNING id, name, login, avatar_url, bio, status_text", args)
            return _resp(200, {'user': cur.fetchone()})

        # ===== Посты в сообществах =====
        if action == 'community-posts':
            cid = int(params.get('community_id', 0))
            cur.execute(
                """
                SELECT p.id, p.text, p.media_url, p.created_at,
                       u.id AS author_id, u.name AS author_name, u.avatar_url AS author_avatar
                FROM community_posts p JOIN users u ON u.id = p.user_id
                WHERE p.community_id = %s ORDER BY p.created_at DESC LIMIT 100
                """,
                (cid,)
            )
            return _resp(200, {'posts': cur.fetchall(), 'me': uid})

        if action == 'community-post-create':
            body = json.loads(event.get('body') or '{}')
            cid = int(body.get('community_id', 0))
            text = (body.get('text') or '').strip()
            media_url = (body.get('media_url') or '').strip() or None
            if not cid or (not text and not media_url):
                return _resp(400, {'error': 'Пустая публикация'})
            cur.execute("SELECT type, owner_id FROM communities WHERE id = %s", (cid,))
            comm = cur.fetchone()
            if not comm:
                return _resp(404, {'error': 'Сообщество не найдено'})
            cur.execute("SELECT 1 FROM community_members WHERE community_id = %s AND user_id = %s", (cid, uid))
            is_member = cur.fetchone()
            if comm['type'] == 'channel' and comm['owner_id'] != uid:
                return _resp(403, {'error': 'В канале публиковать может только владелец'})
            if not is_member:
                return _resp(403, {'error': 'Сначала вступите в сообщество'})
            cur.execute(
                "INSERT INTO community_posts (community_id, user_id, text, media_url) VALUES (%s, %s, %s, %s) RETURNING id, created_at",
                (cid, uid, text or None, media_url)
            )
            row = cur.fetchone()
            return _resp(200, {'id': row['id'], 'created_at': row['created_at']})

        if action == 'community-post-delete':
            body = json.loads(event.get('body') or '{}')
            pid = int(body.get('post_id', 0))
            cur.execute(
                """
                SELECT p.user_id, c.owner_id FROM community_posts p
                JOIN communities c ON c.id = p.community_id WHERE p.id = %s
                """,
                (pid,)
            )
            row = cur.fetchone()
            if not row:
                return _resp(404, {'error': 'Пост не найден'})
            if row['user_id'] != uid and row['owner_id'] != uid:
                return _resp(403, {'error': 'Нет прав на удаление'})
            cur.execute("DELETE FROM community_posts WHERE id = %s", (pid,))
            return _resp(200, {'ok': True})

        # ===== Блокировка пользователей =====
        if action == 'block-toggle':
            body = json.loads(event.get('body') or '{}')
            target = int(body.get('user_id', 0))
            if target == uid:
                return _resp(400, {'error': 'Нельзя заблокировать себя'})
            cur.execute("SELECT 1 FROM user_blocks WHERE blocker_id = %s AND blocked_id = %s", (uid, target))
            if cur.fetchone():
                cur.execute("DELETE FROM user_blocks WHERE blocker_id = %s AND blocked_id = %s", (uid, target))
                return _resp(200, {'blocked': False})
            cur.execute("INSERT INTO user_blocks (blocker_id, blocked_id) VALUES (%s, %s)", (uid, target))
            return _resp(200, {'blocked': True})

        if action == 'blocks-list':
            cur.execute(
                """
                SELECT u.id, u.name, u.avatar_url FROM user_blocks b
                JOIN users u ON u.id = b.blocked_id WHERE b.blocker_id = %s ORDER BY b.created_at DESC
                """,
                (uid,)
            )
            return _resp(200, {'blocked': cur.fetchall()})

        # ===== WebRTC звонки (сигналинг через polling) =====
        if action == 'call-start':
            body = json.loads(event.get('body') or '{}')
            callee_id = int(body.get('callee_id', 0))
            call_type = body.get('call_type') if body.get('call_type') in ('audio', 'video') else 'video'
            offer = body.get('offer_sdp') or ''
            if not callee_id or not offer:
                return _resp(400, {'error': 'Нет данных звонка'})
            cur.execute(
                "SELECT 1 FROM user_blocks WHERE (blocker_id = %s AND blocked_id = %s) OR (blocker_id = %s AND blocked_id = %s)",
                (uid, callee_id, callee_id, uid)
            )
            if cur.fetchone():
                return _resp(403, {'error': 'Звонок недоступен'})
            cur.execute("UPDATE calls SET status = 'ended' WHERE (caller_id = %s OR callee_id = %s) AND status IN ('ringing', 'active')", (uid, uid))
            cur.execute(
                "INSERT INTO calls (caller_id, callee_id, call_type, status, offer_sdp) VALUES (%s, %s, %s, 'ringing', %s) RETURNING id",
                (uid, callee_id, call_type, offer)
            )
            return _resp(200, {'call_id': cur.fetchone()['id']})

        if action == 'call-incoming':
            cur.execute(
                """
                SELECT c.id, c.caller_id, c.call_type, c.offer_sdp,
                       u.name AS caller_name, u.avatar_url AS caller_avatar
                FROM calls c JOIN users u ON u.id = c.caller_id
                WHERE c.callee_id = %s AND c.status = 'ringing'
                AND c.created_at > NOW() - INTERVAL '60 seconds'
                ORDER BY c.id DESC LIMIT 1
                """,
                (uid,)
            )
            return _resp(200, {'call': cur.fetchone()})

        if action == 'call-answer':
            body = json.loads(event.get('body') or '{}')
            call_id = int(body.get('call_id', 0))
            answer = body.get('answer_sdp') or ''
            cur.execute("SELECT callee_id FROM calls WHERE id = %s", (call_id,))
            row = cur.fetchone()
            if not row or row['callee_id'] != uid:
                return _resp(403, {'error': 'Нет доступа к звонку'})
            cur.execute("UPDATE calls SET answer_sdp = %s, status = 'active', updated_at = NOW() WHERE id = %s", (answer, call_id))
            return _resp(200, {'ok': True})

        if action == 'call-poll':
            call_id = int(params.get('call_id', 0))
            cur.execute("SELECT caller_id, callee_id, status, answer_sdp FROM calls WHERE id = %s", (call_id,))
            row = cur.fetchone()
            if not row or uid not in (row['caller_id'], row['callee_id']):
                return _resp(404, {'error': 'Звонок не найден'})
            return _resp(200, {'status': row['status'], 'answer_sdp': row['answer_sdp']})

        if action == 'call-end':
            body = json.loads(event.get('body') or '{}')
            call_id = int(body.get('call_id', 0))
            cur.execute("UPDATE calls SET status = 'ended', updated_at = NOW() WHERE id = %s AND (caller_id = %s OR callee_id = %s)", (call_id, uid, uid))
            return _resp(200, {'ok': True})

        if action == 'call-ice-add':
            body = json.loads(event.get('body') or '{}')
            call_id = int(body.get('call_id', 0))
            candidate = json.dumps(body.get('candidate'))
            cur.execute("INSERT INTO call_candidates (call_id, sender_id, candidate) VALUES (%s, %s, %s)", (call_id, uid, candidate))
            return _resp(200, {'ok': True})

        if action == 'call-ice-get':
            call_id = int(params.get('call_id', 0))
            after = int(params.get('after', 0))
            cur.execute(
                "SELECT id, candidate FROM call_candidates WHERE call_id = %s AND sender_id != %s AND id > %s ORDER BY id ASC",
                (call_id, uid, after)
            )
            return _resp(200, {'candidates': cur.fetchall()})

        return _resp(400, {'error': 'Неизвестное действие'})
    finally:
        cur.close()
        conn.close()