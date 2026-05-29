import json
import os
import base64
import uuid
import boto3

def _cors():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
        'Content-Type': 'application/json'
    }

def _resp(status, body):
    return {'statusCode': status, 'headers': _cors(), 'isBase64Encoded': False, 'body': json.dumps(body)}

def _user_id(event):
    headers = event.get('headers') or {}
    token = headers.get('X-Auth-Token') or headers.get('x-auth-token') or ''
    if ':' not in token:
        return None
    try:
        return int(token.rsplit(':', 1)[1])
    except Exception:
        return None

EXT = {
    'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
    'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
    'audio/webm': 'webm', 'audio/mpeg': 'mp3', 'audio/ogg': 'ogg',
    'application/pdf': 'pdf'
}

def handler(event: dict, context) -> dict:
    '''
    Загрузка медиафайлов (фото, видео, кружки, голосовые) в облачное хранилище.
    Принимает base64 в теле запроса, возвращает публичный URL.
    '''
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': _cors(), 'body': ''}

    uid = _user_id(event)
    if not uid:
        return _resp(401, {'error': 'Не авторизован'})

    body = json.loads(event.get('body') or '{}')
    content_type = body.get('content_type', 'image/jpeg')
    data_b64 = body.get('data', '')
    folder = body.get('folder', 'media')

    if not data_b64:
        return _resp(400, {'error': 'Нет данных файла'})

    try:
        raw = base64.b64decode(data_b64)
    except Exception:
        return _resp(400, {'error': 'Некорректные данные'})

    if len(raw) > 50 * 1024 * 1024:
        return _resp(400, {'error': 'Файл больше 50 МБ'})

    ext = EXT.get(content_type, 'bin')
    key = f'{folder}/{uid}/{uuid.uuid4().hex}.{ext}'

    s3 = boto3.client(
        's3',
        endpoint_url='https://bucket.poehali.dev',
        aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
        aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY']
    )
    s3.put_object(Bucket='files', Key=key, Body=raw, ContentType=content_type)

    cdn_url = f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"
    return _resp(200, {'url': cdn_url, 'size': len(raw)})
