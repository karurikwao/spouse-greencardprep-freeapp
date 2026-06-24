import os
import uuid
import hmac
import hashlib
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify, send_file
from auth import require_auth, require_admin, optional_auth
import db

pdf_bp = Blueprint('pdf', __name__)

PDF_STORAGE_PATH = os.getenv('PDF_STORAGE_PATH', './storage/pdfs')
URL_SECRET = os.getenv('JWT_SECRET', 'change-this-secret')
PDF_DOWNLOAD_SOURCES = {
    'topic_page',
    'practice_mode',
    'practice_completion',
    'direct_link',
    'seo_page',
    'pdf_library',
}


def normalize_download_source(value):
    source = str(value or 'topic_page').strip()
    return source if source in PDF_DOWNLOAD_SOURCES else 'topic_page'


@pdf_bp.route('/generate-signed-url', methods=['POST'])
@require_auth
def generate_signed_url():
    user = request.current_user
    data = request.get_json()
    file_key = data.get('fileKey')
    topic_id = data.get('topicId')
    category_id = data.get('categoryId')
    download_source = normalize_download_source(data.get('downloadSource') or data.get('download_source'))

    if not file_key:
        return jsonify({'success': False, 'error': 'fileKey is required'}), 400

    pdf_asset = db.query_one("SELECT * FROM pdf_assets WHERE file_key = %s", (file_key,))

    expires_at = int(datetime.now(timezone.utc).timestamp()) + 300
    message = f"{file_key}:{user['id']}:{expires_at}"
    signature = hmac.new(URL_SECRET.encode(), message.encode(), hashlib.sha256).hexdigest()
    signed_url = f"/api/pdf/serve?fileKey={file_key}&expires={expires_at}&sig={signature}&userId={user['id']}"

    try:
        db.call_function('record_pdf_download', (
            user['id'], user['email'], file_key,
            pdf_asset.get('title') if pdf_asset else file_key,
            topic_id, category_id, download_source, 'access_granted', None, None
        ))
    except Exception:
        pass

    return jsonify({
        'success': True,
        'signedUrl': signed_url,
        'expiresIn': 300,
        'fileKey': file_key,
    })


@pdf_bp.route('/serve', methods=['GET'])
def serve_pdf():
    file_key = request.args.get('fileKey')
    expires = request.args.get('expires')
    sig = request.args.get('sig')
    user_id = request.args.get('userId')

    if not file_key or not expires or not sig:
        return jsonify({'error': 'Missing parameters'}), 400

    try:
        expires_int = int(expires)
    except ValueError:
        return jsonify({'error': 'Invalid expires parameter'}), 400

    if datetime.now(timezone.utc).timestamp() > expires_int:
        return jsonify({'error': 'Signed URL expired'}), 410

    message = f"{file_key}:{user_id}:{expires_int}"
    expected_sig = hmac.new(URL_SECRET.encode(), message.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        return jsonify({'error': 'Invalid signature'}), 403

    storage_path = pdf_asset_storage_path(file_key)
    if not os.path.exists(storage_path):
        return jsonify({'error': 'PDF file not found'}), 404

    return send_file(storage_path, mimetype='application/pdf', as_attachment=False)


def pdf_asset_storage_path(file_key):
    return os.path.join(PDF_STORAGE_PATH, file_key)


@pdf_bp.route('/record-download', methods=['POST'])
@require_auth
def record_download():
    user = request.current_user
    data = request.get_json()

    try:
        event_id = db.call_function('record_pdf_download', (
            user['id'], user['email'],
            data.get('pdf_filename'),
            data.get('pdf_title'),
            data.get('topic_id'),
            data.get('category_id'),
            data.get('download_source', 'topic_page'),
            data.get('event_status', 'requested'),
            data.get('session_hash'),
            data.get('user_agent_hash'),
        ))
        return jsonify({'eventId': str(event_id) if event_id else None})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@pdf_bp.route('/download-summary', methods=['GET'])
@require_auth
def get_download_summary():
    user = request.current_user
    result = db.call_function('get_user_download_summary', (user['id'],))
    return jsonify(result or {})
