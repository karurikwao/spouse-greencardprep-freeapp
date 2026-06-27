import os
import logging
import html
from flask import Flask, Response, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()


def _current_ad_settings():
    try:
        from admin_settings import saved_ad_settings_config
        return saved_ad_settings_config()
    except Exception:
        return {'status': 'disabled'}


def _ad_head_snippet():
    settings = _current_ad_settings()
    if settings.get('status') == 'disabled':
        return ''

    publisher_id = str(settings.get('adsensePublisherId') or '').strip()
    if not publisher_id:
        return ''

    escaped_publisher_id = html.escape(publisher_id, quote=True)
    snippets = []

    if settings.get('includeAdsenseMeta', True):
        snippets.append(f'<meta name="google-adsense-account" content="{escaped_publisher_id}">')

    if settings.get('includeAdsenseScript', False):
        snippets.append(
            '<script async '
            f'src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client={escaped_publisher_id}" '
            'crossorigin="anonymous"></script>'
        )

    if not snippets:
        return ''

    return '\n    <!-- Admin ad verification settings -->\n    ' + '\n    '.join(snippets)


def _run_robin_saved_answer_startup_cleanup():
    enabled = os.getenv('ROBIN_SAVED_ANSWER_CLEANUP_ON_STARTUP', 'true').strip().lower()
    if enabled in {'0', 'false', 'no', 'off'}:
        return

    marker_key = 'robin_saved_answer_cleanup_2026_06_26_v1'
    try:
        from admin_settings import get_admin_setting, save_admin_setting
        existing = get_admin_setting(marker_key, None)
        if isinstance(existing, dict) and existing.get('completed'):
            return

        from routes.ai_routes import _cleanup_dashboard_agent_memory_answers
        result = _cleanup_dashboard_agent_memory_answers(limit=1000, dry_run=False)
        save_admin_setting(marker_key, {
            'completed': True,
            'scanned': result.get('scanned', 0),
            'cleanable': result.get('cleanable', 0),
            'updated': result.get('updated', 0),
        })
        logging.info(
            'Robin saved-answer startup cleanup completed: scanned=%s cleanable=%s updated=%s',
            result.get('scanned', 0),
            result.get('cleanable', 0),
            result.get('updated', 0),
        )
    except Exception as exc:
        logging.warning('Robin saved-answer startup cleanup skipped: %s', exc)


def _cleanup_example_invalid_probe_users():
    enabled = os.getenv('CLEANUP_EXAMPLE_INVALID_USERS_ON_STARTUP', '').strip().lower()
    if enabled != 'true':
        return

    try:
        import db
        deleted = db.query_all(
            """
            DELETE FROM users
            WHERE lower(email) LIKE %s
            RETURNING id::text, email
            """,
            ('%@example.invalid',),
        )
        if deleted:
            logging.info('Cleaned up %s example.invalid probe users.', len(deleted))
    except Exception as exc:
        logging.warning('Example.invalid probe user cleanup skipped: %s', exc)


def _serve_index_with_ad_settings(static_dir):
    index_path = os.path.join(static_dir, 'index.html')
    try:
        with open(index_path, 'r', encoding='utf-8') as file:
            index_html = file.read()
        snippet = _ad_head_snippet()
        if snippet and '</head>' in index_html:
            index_html = index_html.replace('</head>', f'{snippet}\n  </head>', 1)
        return Response(index_html, 200, {'Content-Type': 'text/html; charset=utf-8'})
    except Exception:
        return send_from_directory(static_dir, 'index.html')


def create_app():
    static_dir = os.getenv('STATIC_DIR') or os.path.join(os.path.dirname(__file__), 'static')
    app = Flask(__name__, static_folder=None)
    app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024

    CORS(app, origins=[
        os.getenv('FRONTEND_URL', 'http://localhost:5173'),
        'http://localhost:5173',
        'http://localhost:3000',
    ], supports_credentials=True, allow_headers=['Content-Type', 'Authorization'])

    logging.basicConfig(level=logging.INFO)

    from routes.auth_routes import auth_bp
    from routes.stripe_routes import stripe_bp
    from routes.ai_routes import ai_bp
    from routes.pdf_routes import pdf_bp
    from routes.api_routes import api_bp

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(stripe_bp, url_prefix='/api/stripe')
    app.register_blueprint(ai_bp, url_prefix='/api/ai')
    app.register_blueprint(pdf_bp, url_prefix='/api/pdf')
    app.register_blueprint(api_bp, url_prefix='/api')

    _run_robin_saved_answer_startup_cleanup()
    _cleanup_example_invalid_probe_users()

    @app.route('/api', methods=['GET'])
    @app.route('/api/health', methods=['GET'])
    @app.route('/api/healthz', methods=['GET'])
    def api_health():
        return jsonify({'status': 'ok', 'service': 'greencardprep-api'})

    @app.route('/health', methods=['GET'])
    @app.route('/healthz', methods=['GET'])
    def health():
        return 'OK', 200, {'Content-Type': 'text/plain; charset=utf-8'}

    @app.route('/ads.txt', methods=['GET'])
    def ads_txt():
        settings = _current_ad_settings()
        if settings.get('status') == 'disabled' or not settings.get('enableAdsTxt'):
            return Response('', 404, {'Content-Type': 'text/plain; charset=utf-8'})
        content = str(settings.get('adsTxt') or '').strip()
        if not content:
            return Response('', 404, {'Content-Type': 'text/plain; charset=utf-8'})
        return Response(content + '\n', 200, {'Content-Type': 'text/plain; charset=utf-8'})

    if static_dir:
        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve_frontend(path):
            if path.startswith('api/'):
                return jsonify({'error': 'Not found'}), 404
            if path == 'favicon.ico':
                favicon_path = os.path.join(static_dir, 'favicon.ico')
                if os.path.isfile(favicon_path):
                    return send_from_directory(static_dir, 'favicon.ico')
                png_favicon = os.path.join(static_dir, 'icons', 'icon-192x192.png')
                if os.path.isfile(png_favicon):
                    return send_from_directory(os.path.join(static_dir, 'icons'), 'icon-192x192.png')
                return Response('', 404, {'Content-Type': 'image/x-icon'})
            if path == 'service-worker.js':
                sw_path = os.path.join(static_dir, 'sw.js')
                if os.path.isfile(sw_path):
                    return send_from_directory(static_dir, 'sw.js', mimetype='application/javascript')
                return Response('', 404, {'Content-Type': 'application/javascript'})
            requested_path = os.path.join(static_dir, path)
            if path and os.path.exists(requested_path) and os.path.isfile(requested_path):
                return send_from_directory(static_dir, path)
            return _serve_index_with_ad_settings(static_dir)

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({'error': 'Not found'}), 404

    @app.errorhandler(500)
    def server_error(e):
        return jsonify({'error': 'Internal server error'}), 500

    return app


if __name__ == '__main__':
    app = create_app()
    port = int(os.getenv('PORT', '5000'))
    debug = os.getenv('FLASK_ENV', 'development') == 'development'
    app.run(host='0.0.0.0', port=port, debug=debug)
