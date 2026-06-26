import os
import uuid
from urllib.parse import urlencode
from flask import Blueprint, request, jsonify
import jwt
from jwt import PyJWKClient
import requests
from auth import (
    hash_password, verify_password, create_token, create_refresh_token,
    create_password_reset_token, decode_token, require_auth, require_admin, optional_auth
)
import db
from email_service import send_password_reset_message, send_welcome_email
from lifecycle_messages import send_lifecycle_dashboard_message

auth_bp = Blueprint('auth', __name__)
GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs'
GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'
GOOGLE_CLIENT_ID_FALLBACK = '525916855163-4qt3urorpvh8lrs6rqidcscngcmn999d.apps.googleusercontent.com'
DEFAULT_BOOTSTRAP_SUPERADMIN_EMAILS = ('luewaweru@gmail.com',)
google_jwks_client = PyJWKClient(GOOGLE_JWKS_URL)


def bootstrap_superadmin_emails() -> set[str]:
    configured = os.getenv('BOOTSTRAP_SUPERADMIN_EMAILS') or os.getenv('SUPERADMIN_EMAILS') or ''
    emails = {email.strip().lower() for email in configured.split(',') if email.strip()}
    emails.update(DEFAULT_BOOTSTRAP_SUPERADMIN_EMAILS)
    return emails


def ensure_bootstrap_superadmin(email: str, user_id: str) -> str | None:
    normalized_email = (email or '').strip().lower()
    if normalized_email not in bootstrap_superadmin_emails():
        return None

    db.execute(
        """
        INSERT INTO user_profiles (user_id, email, display_name, role, is_active)
        VALUES (%s, %s, %s, 'superadmin', true)
        ON CONFLICT (user_id) DO UPDATE SET
            email = EXCLUDED.email,
            role = 'superadmin',
            is_active = true,
            updated_at = now()
        """,
        (user_id, normalized_email, normalized_email),
    )
    return 'superadmin'


def send_password_reset_email(email: str, reset_token: str, redirect_to: str | None = None):
    frontend_url = os.getenv('FRONTEND_URL', 'http://localhost:5173')

    reset_base = (redirect_to or f"{frontend_url}/reset-password").split('?', 1)[0].rstrip('/')
    reset_url = f"{reset_base}?{urlencode({'token': reset_token})}"

    result = send_password_reset_message(email, reset_url)
    if result.get('skipped'):
        print(f"[DEV] Password reset for {email}: {reset_url}")

    return result.get('success', False)


def verify_google_credential(credential: str):
    client_ids = []
    for value in (os.getenv('GOOGLE_CLIENT_ID'), os.getenv('VITE_GOOGLE_CLIENT_ID'), GOOGLE_CLIENT_ID_FALLBACK):
        for client_id in str(value or '').split(','):
            client_id = client_id.strip()
            if client_id and client_id not in client_ids:
                client_ids.append(client_id)

    if not client_ids:
        raise RuntimeError('Google sign-in is not configured')

    try:
        signing_key = google_jwks_client.get_signing_key_from_jwt(credential)
        payload = jwt.decode(
            credential,
            signing_key.key,
            algorithms=['RS256'],
            audience=client_ids,
            options={'verify_iss': False},
        )
    except Exception as local_error:
        print(f'Google local token verification failed: {type(local_error).__name__}: {local_error}', flush=True)
        response = requests.get(GOOGLE_TOKENINFO_URL, params={'id_token': credential}, timeout=5)
        if response.status_code >= 400:
            raise jwt.InvalidTokenError(f'Google tokeninfo verification failed: {response.text[:300]}') from local_error
        payload = response.json()
        if payload.get('aud') not in client_ids:
            raise jwt.InvalidAudienceError('Google token audience does not match configured client IDs') from local_error

    if payload.get('iss') not in {'https://accounts.google.com', 'accounts.google.com'}:
        raise jwt.InvalidIssuerError('Invalid Google token issuer')
    if isinstance(payload.get('email_verified'), str):
        payload['email_verified'] = payload['email_verified'].lower() == 'true'
    return payload


@auth_bp.route('/signup', methods=['POST'])
def signup():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    first_name = data.get('first_name', data.get('metadata', {}).get('first_name'))
    last_name = data.get('last_name', data.get('metadata', {}).get('last_name'))
    promo_code = data.get('promo_code', data.get('metadata', {}).get('promo_code'))

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    existing = db.query_one("SELECT id FROM users WHERE email = %s", (email,))
    if existing:
        return jsonify({'error': 'User already registered', 'code': 'USER_EXISTS'}), 409

    user_id = str(uuid.uuid4())
    password_hash = hash_password(password)

    with db.get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, %s)",
            (user_id, email, password_hash)
        )
        cur.execute(
            """UPDATE user_profiles
               SET first_name = %s,
                   last_name = %s,
                   display_name = %s,
                   referral_code = %s,
                   updated_at = now()
               WHERE user_id = %s""",
            (
                first_name, last_name,
                (f"{first_name} {last_name}".strip() if first_name and last_name else email),
                promo_code,
                user_id
            )
        )
        cur.execute(
            """UPDATE user_subscriptions
               SET trial_starts_at = COALESCE(trial_starts_at, now()),
                   trial_ends_at = COALESCE(trial_ends_at, now() + INTERVAL '7 days'),
                   updated_at = now()
               WHERE user_id = %s""",
            (user_id,)
        )
        conn.commit()
        cur.close()

    try:
        send_welcome_email(email, first_name)
    except Exception as e:
        print(f"Welcome email failed for {email}: {e}")

    try:
        send_lifecycle_dashboard_message(user_id, email, 'signup')
    except Exception as e:
        print(f"Dashboard welcome message failed for {email}: {e}")

    token = create_token(user_id, email, 'user')
    refresh = create_refresh_token(user_id)

    return jsonify({
        'user': {'id': user_id, 'email': email},
        'accessToken': token,
        'refreshToken': refresh,
        'access_token': token,
        'refresh_token': refresh,
        'token_type': 'bearer',
        'expires_in': int(os.getenv('JWT_EXPIRY_HOURS', '168')) * 3600,
    }), 201


@auth_bp.route('/signin', methods=['POST'])
def signin():
    data = request.get_json()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400

    user = db.query_one("SELECT id, email, password_hash FROM users WHERE email = %s", (email,))
    if not user:
        return jsonify({'error': 'Invalid login credentials'}), 401

    if not user.get('password_hash'):
        return jsonify({'error': 'Please use social login or reset your password'}), 401

    if not verify_password(password, user['password_hash']):
        return jsonify({'error': 'Invalid login credentials'}), 401

    role = ensure_bootstrap_superadmin(email, str(user['id']))
    if not role:
        profile = db.query_one("SELECT role FROM user_profiles WHERE user_id = %s", (user['id'],))
        role = profile['role'] if profile else 'user'

    token = create_token(str(user['id']), user['email'], role)
    refresh = create_refresh_token(str(user['id']))

    return jsonify({
        'user': {'id': str(user['id']), 'email': user['email']},
        'accessToken': token,
        'refreshToken': refresh,
        'access_token': token,
        'refresh_token': refresh,
        'token_type': 'bearer',
        'expires_in': int(os.getenv('JWT_EXPIRY_HOURS', '168')) * 3600,
    })


@auth_bp.route('/google', methods=['POST'])
def google_signin():
    data = request.get_json() or {}
    credential = data.get('credential') or data.get('idToken') or ''
    metadata = data.get('metadata') if isinstance(data.get('metadata'), dict) else {}

    if not credential:
        return jsonify({'error': 'Google credential is required'}), 400

    try:
        payload = verify_google_credential(credential)
    except RuntimeError as e:
        return jsonify({'error': str(e), 'code': 'GOOGLE_AUTH_NOT_CONFIGURED'}), 503
    except Exception as e:
        print(f'Google sign-in verification failed: {type(e).__name__}: {e}', flush=True)
        return jsonify({'error': 'Google sign-in could not be verified'}), 401

    email = str(payload.get('email') or '').strip().lower()
    if not email or not payload.get('email_verified'):
        return jsonify({'error': 'Google account email must be verified'}), 401

    first_name = str(metadata.get('first_name') or payload.get('given_name') or '').strip() or None
    last_name = str(metadata.get('last_name') or payload.get('family_name') or '').strip() or None
    display_name = str(payload.get('name') or f"{first_name or ''} {last_name or ''}".strip() or email).strip()
    promo_code = str(metadata.get('promo_code') or '').strip() or None

    existing = db.query_one("SELECT id, email FROM users WHERE email = %s", (email,))
    is_new_user = False
    if existing:
        user_id = str(existing['id'])
    else:
        user_id = str(uuid.uuid4())
        db.execute(
            "INSERT INTO users (id, email, password_hash) VALUES (%s, %s, NULL)",
            (user_id, email)
        )
        is_new_user = True

    db.execute(
        """
        UPDATE user_profiles
        SET first_name = COALESCE(NULLIF(first_name, ''), %s),
            last_name = COALESCE(NULLIF(last_name, ''), %s),
            display_name = CASE
                WHEN display_name IS NULL OR display_name = '' OR display_name = email THEN %s
                ELSE display_name
            END,
            referral_code = COALESCE(NULLIF(referral_code, ''), %s),
            updated_at = now()
        WHERE user_id = %s
        """,
        (first_name, last_name, display_name, promo_code, user_id)
    )

    if is_new_user:
        try:
            send_welcome_email(email, first_name)
        except Exception as e:
            print(f"Welcome email failed for {email}: {e}")

        try:
            send_lifecycle_dashboard_message(user_id, email, 'signup')
        except Exception as e:
            print(f"Dashboard welcome message failed for {email}: {e}")

    role = ensure_bootstrap_superadmin(email, user_id)
    if not role:
        profile = db.query_one("SELECT role FROM user_profiles WHERE user_id = %s", (user_id,))
        role = profile['role'] if profile else 'user'
    token = create_token(user_id, email, role)
    refresh = create_refresh_token(user_id)

    return jsonify({
        'user': {'id': user_id, 'email': email, 'role': role},
        'accessToken': token,
        'refreshToken': refresh,
        'access_token': token,
        'refresh_token': refresh,
        'token_type': 'bearer',
        'expires_in': int(os.getenv('JWT_EXPIRY_HOURS', '168')) * 3600,
        'isNewUser': is_new_user,
    })


@auth_bp.route('/signout', methods=['POST'])
@require_auth
def signout():
    return jsonify({'message': 'Signed out successfully'})


@auth_bp.route('/user', methods=['GET'])
@require_auth
def get_user():
    user = request.current_user
    profile = user.get('profile', {})

    return jsonify({
        'id': user['id'],
        'email': user['email'],
        'role': user['role'],
        'first_name': profile.get('first_name'),
        'last_name': profile.get('last_name'),
        'display_name': profile.get('display_name'),
        'referral_code': profile.get('referral_code'),
        'is_active': profile.get('is_active', True),
    })


@auth_bp.route('/user', methods=['PUT'])
@require_auth
def update_user():
    user = request.current_user
    data = request.get_json()

    updates = {}
    if 'password' in data:
        password_hash = hash_password(data['password'])
        db.execute("UPDATE users SET password_hash = %s WHERE id = %s", (password_hash, user['id']))

    if 'email' in data:
        new_email = data['email'].strip().lower()
        db.execute("UPDATE users SET email = %s WHERE id = %s", (new_email, user['id']))
        db.execute("UPDATE user_profiles SET email = %s, updated_at = now() WHERE user_id = %s", (new_email, user['id']))

    profile_fields = {}
    for field in ('first_name', 'last_name', 'display_name'):
        if field in data:
            profile_fields[field] = data[field]

    if profile_fields:
        set_clauses = ', '.join(f"{k} = %s" for k in profile_fields)
        values = list(profile_fields.values()) + [user['id']]
        db.execute(f"UPDATE user_profiles SET {set_clauses}, updated_at = now() WHERE user_id = %s", values)

    return jsonify({'message': 'User updated successfully'})


@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    data = request.get_json()
    email = data.get('email', '').strip().lower()

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    user = db.query_one("SELECT id FROM users WHERE email = %s", (email,))
    if not user:
        return jsonify({'message': 'If an account exists with this email, a reset link will be sent'}), 200

    reset_token = create_password_reset_token(str(user['id']), email)
    send_password_reset_email(email, reset_token, data.get('redirectTo'))

    return jsonify({'message': 'If an account exists with this email, a reset link will be sent'})


@auth_bp.route('/update-password', methods=['POST'])
def update_password_with_token():
    data = request.get_json()
    token = data.get('token', '')
    new_password = data.get('password') or data.get('newPassword') or ''

    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer ') and not token:
        token = auth_header.split(' ', 1)[1]

    if not token or not new_password:
        return jsonify({'error': 'Token and new password are required'}), 400

    payload = decode_token(token)
    if not payload:
        return jsonify({'error': 'Invalid or expired reset token'}), 400

    if payload.get('type') != 'password_reset' or payload.get('role') != 'password_reset':
        return jsonify({'error': 'Invalid reset token'}), 400

    user_id = payload.get('sub')
    if len(new_password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    password_hash = hash_password(new_password)
    updated = db.execute_returning(
        "UPDATE users SET password_hash = %s, updated_at = now() WHERE id = %s RETURNING id",
        (password_hash, user_id)
    )
    if not updated:
        return jsonify({'error': 'Invalid reset token'}), 400

    return jsonify({'message': 'Password updated successfully'})


@auth_bp.route('/session', methods=['GET'])
@require_auth
def get_session():
    user = request.current_user
    profile = user.get('profile', {})

    token = create_token(user['id'], user['email'], user['role'])
    refresh = create_refresh_token(user['id'])

    return jsonify({
        'accessToken': token,
        'refreshToken': refresh,
        'access_token': token,
        'refresh_token': refresh,
        'token_type': 'bearer',
        'expires_in': int(os.getenv('JWT_EXPIRY_HOURS', '168')) * 3600,
        'user': {
            'id': user['id'],
            'email': user['email'],
            'role': user['role'],
            'user_metadata': {
                'first_name': profile.get('first_name'),
                'last_name': profile.get('last_name'),
                'display_name': profile.get('display_name'),
            }
        }
    })


@auth_bp.route('/profile', methods=['GET'])
@require_auth
def get_profile():
    user = request.current_user
    profile = db.query_one("SELECT * FROM user_profiles WHERE user_id = %s", (user['id'],))
    if profile:
        profile['id'] = str(profile.get('id', ''))
        profile['user_id'] = str(profile['user_id'])
    return jsonify(profile or {})


@auth_bp.route('/profile', methods=['PUT'])
@require_auth
def update_profile():
    user = request.current_user
    data = request.get_json()

    fields = {}
    for field in ('first_name', 'last_name', 'display_name', 'referral_code'):
        if field in data:
            fields[field] = data[field]

    if fields:
        set_clauses = ', '.join(f"{k} = %s" for k in fields)
        values = list(fields.values()) + [user['id']]
        db.execute(f"UPDATE user_profiles SET {set_clauses}, updated_at = now() WHERE user_id = %s", values)

    profile = db.query_one("SELECT * FROM user_profiles WHERE user_id = %s", (user['id'],))
    return jsonify(profile or {})


@auth_bp.route('/admin-check', methods=['GET'])
@require_auth
def admin_check():
    user = request.current_user
    return jsonify({
        'is_admin': user['role'] in ('admin', 'superadmin'),
        'is_superadmin': user['role'] == 'superadmin',
    })


@auth_bp.route('/update-email', methods=['POST'])
@require_auth
def update_email():
    user = request.current_user
    data = request.get_json()
    new_email = (data.get('newEmail') or data.get('new_email') or '').strip().lower()

    if not new_email:
        return jsonify({'error': 'New email is required'}), 400

    existing = db.query_one("SELECT id FROM users WHERE email = %s AND id != %s", (new_email, user['id']))
    if existing:
        return jsonify({'error': 'Email already in use', 'code': 'EMAIL_EXISTS'}), 409

    db.execute("UPDATE users SET email = %s WHERE id = %s", (new_email, user['id']))
    db.execute("UPDATE user_profiles SET email = %s, updated_at = now() WHERE user_id = %s", (new_email, user['id']))

    token = create_token(user['id'], new_email, user['role'])
    return jsonify({
        'message': 'Email updated successfully',
        'user': {'id': user['id'], 'email': new_email},
        'accessToken': token,
        'access_token': token,
    })


@auth_bp.route('/delete-account', methods=['POST'])
@require_auth
def delete_account():
    user = request.current_user
    db.execute("DELETE FROM users WHERE id = %s", (user['id'],))
    return jsonify({'message': 'Account deleted successfully'})


@auth_bp.route('/refresh', methods=['POST'])
def refresh_token():
    data = request.get_json()
    refresh = data.get('refresh_token') or data.get('refreshToken') or ''

    payload = decode_token(refresh)
    if not payload or payload.get('type') != 'refresh':
        return jsonify({'error': 'Invalid refresh token'}), 401

    user_id = payload.get('sub')
    user = db.query_one("SELECT id, email FROM users WHERE id = %s", (user_id,))
    if not user:
        return jsonify({'error': 'User not found'}), 401

    profile = db.query_one("SELECT role FROM user_profiles WHERE user_id = %s", (user_id,))
    role = profile['role'] if profile else 'user'

    token = create_token(str(user['id']), user['email'], role)
    return jsonify({
        'accessToken': token,
        'refreshToken': refresh,
        'access_token': token,
        'refresh_token': refresh,
        'token_type': 'bearer',
        'user': {'id': str(user['id']), 'email': user['email'], 'role': role},
    })
