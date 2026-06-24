import os
import jwt
import bcrypt
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import request, jsonify, current_app
import db

JWT_SECRET = os.getenv('JWT_SECRET', 'change-this-secret-in-production')
JWT_EXPIRY_HOURS = int(os.getenv('JWT_EXPIRY_HOURS', '168'))
PASSWORD_RESET_EXPIRY_MINUTES = int(os.getenv('PASSWORD_RESET_EXPIRY_MINUTES', '60'))


def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))


def create_token(user_id: str, email: str, role: str = 'user') -> str:
    payload = {
        'sub': user_id,
        'email': email,
        'role': role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def create_password_reset_token(user_id: str, email: str) -> str:
    issued_at = datetime.now(timezone.utc)
    payload = {
        'sub': user_id,
        'email': email,
        'role': 'password_reset',
        'type': 'password_reset',
        'exp': issued_at + timedelta(minutes=PASSWORD_RESET_EXPIRY_MINUTES),
        'iat': issued_at,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def create_refresh_token(user_id: str) -> str:
    payload = {
        'sub': user_id,
        'type': 'refresh',
        'exp': datetime.now(timezone.utc) + timedelta(days=30),
        'iat': datetime.now(timezone.utc),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')


def decode_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def get_user_from_token(token: str) -> dict | None:
    payload = decode_token(token)
    if not payload:
        return None

    user_id = payload.get('sub')
    if not user_id:
        return None

    user = db.query_one("SELECT id, email FROM users WHERE id = %s", (user_id,))
    if not user:
        return None

    profile = db.query_one("SELECT * FROM user_profiles WHERE user_id = %s", (user_id,))

    return {
        'id': str(user['id']),
        'email': user['email'],
        'role': profile['role'] if profile else 'user',
        'profile': profile,
    }


def require_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401

        token = auth_header.split(' ', 1)[1]
        user = get_user_from_token(token)
        if not user:
            return jsonify({'error': 'Invalid or expired token'}), 401

        request.current_user = user
        return f(*args, **kwargs)

    return decorated


def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401

        token = auth_header.split(' ', 1)[1]
        user = get_user_from_token(token)
        if not user:
            return jsonify({'error': 'Invalid or expired token'}), 401

        if user.get('role') not in ('admin', 'superadmin'):
            return jsonify({'error': 'Admin access required'}), 403

        request.current_user = user
        return f(*args, **kwargs)

    return decorated


def require_superadmin(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401

        token = auth_header.split(' ', 1)[1]
        user = get_user_from_token(token)
        if not user:
            return jsonify({'error': 'Invalid or expired token'}), 401

        if user.get('role') != 'superadmin':
            return jsonify({'error': 'Superadmin access required'}), 403

        request.current_user = user
        return f(*args, **kwargs)

    return decorated


def optional_auth(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
            user = get_user_from_token(token)
            request.current_user = user
        else:
            request.current_user = None
        return f(*args, **kwargs)

    return decorated
