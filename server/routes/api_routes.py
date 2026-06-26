import csv
import hashlib
import io
import json
import os
import re
import uuid
from urllib.parse import urlparse
from flask import Blueprint, request, jsonify, redirect, Response
import requests as http_requests
from auth import require_auth, require_admin, optional_auth
import db
from admin_settings import (
    get_admin_setting,
    normalize_ad_settings,
    normalize_pdf_download_offer_settings,
    normalize_robin_usage_settings,
    save_admin_setting,
    saved_ad_settings_config,
    saved_ai_runtime_config,
    saved_pdf_download_offer_config,
    saved_robin_usage_config,
    saved_welcome_message_config,
)
from email_service import (
    send_dashboard_message_email,
    send_refund_alert_admin_email,
    send_support_reply_email,
    send_support_ticket_admin_email,
)
from robin_credits import get_user_robin_credit_summary, grant_robin_credits
from support_service import (
    admin_recipients,
    get_user_support_context,
    has_cancel_signal,
    has_refund_signal,
    json_dumps,
    normalize_ticket_category,
    normalize_ticket_row,
    notify_admins,
    parse_jsonish,
    utc_now_iso,
)
from routes.ai_routes import (
    _build_support_messages,
    _call_provider_with_fallback,
    _default_model_for_provider,
    _normalize_provider_id,
    _openai_compatible_provider,
    _normalize_support_response,
    _role_fallback_timeout,
    _select_default_provider,
    _support_fallback_response,
)

api_bp = Blueprint('api', __name__)


RETIRED_FREE_APP_RPC_FUNCTIONS = {
    'create_or_update_subscription',
    'create_support_ticket',
    'get_user_tickets_with_replies',
    'get_open_tickets_for_admin',
    'reply_to_support_ticket',
    'create_refund_request',
    'get_refund_request_with_download_summary',
    'process_refund_approval',
    'deny_refund_request',
    'get_pending_refund_requests',
    'process-refund',
}

SAFE_SQL_IDENTIFIER_RE = re.compile(r'^[a-zA-Z_][a-zA-Z0-9_]*$')
_TABLE_COLUMN_CACHE = {}

TABLES_WITH_USER_ID = {
    'user_profiles', 'user_subscriptions', 'user_progress',
    'ai_daily_usage', 'ai_session_tracking',
    'pdf_download_events', 'pdf_download_summaries',
    'content_dismissals', 'content_interactions', 'user_notifications',
    'refund_requests', 'support_tickets', 'question_states',
    'partner_connections', 'partner_progress', 'partner_settings',
    'user_topic_progress', 'user_preferences', 'referral_events',
    'answer_example_candidates',
}

AUTO_USER_SCOPE_TABLES = set(TABLES_WITH_USER_ID)

GENERIC_TABLE_READ_TABLES = {
    'user_profiles', 'user_subscriptions', 'plan_config',
    'user_progress', 'ai_daily_usage', 'ai_session_tracking',
    'pdf_assets', 'pdf_download_events', 'pdf_download_summaries',
    'site_announcements', 'site_trust_snippets', 'site_content_blocks',
    'content_dismissals', 'content_interactions',
    'seo_settings', 'seo_expansion_settings', 'seo_expansion_pages',
    'seo_expansion_scheduler_runs', 'seo_expansion_rebuild_attempts',
    'site_verification_codes', 'refund_requests',
    'user_notifications', 'broadcast_messages', 'support_tickets',
    'promo_codes', 'referral_events',
    'answer_example_candidates', 'stripe_webhook_events',
    'question_states', 'download_stats', 'ad_settings',
    'partner_connections', 'partner_progress', 'partner_settings',
    'users', 'user_topic_progress', 'user_preferences',
}

GENERIC_TABLE_ADMIN_READ_TABLES = {
    'pdf_download_events', 'pdf_download_summaries',
    'ai_daily_usage', 'ai_session_tracking',
    'site_announcements', 'site_trust_snippets', 'site_content_blocks',
    'content_interactions', 'seo_expansion_scheduler_runs',
    'seo_expansion_rebuild_attempts', 'refund_requests',
    'broadcast_messages', 'support_tickets',
    'answer_example_candidates', 'stripe_webhook_events',
    'promo_codes', 'referral_events',
    'partner_connections', 'partner_progress', 'partner_settings',
    'users', 'site_verification_codes',
    'download_stats', 'ad_settings',
}

GENERIC_TABLE_INSERT_TABLES = {
    'content_dismissals', 'content_interactions',
    'referral_events', 'user_progress', 'question_states',
    'broadcast_messages',
    'site_announcements', 'site_trust_snippets', 'site_content_blocks',
    'site_verification_codes', 'answer_example_candidates',
    'pdf_download_events', 'promo_codes',
    'user_notifications',
    'partner_connections', 'partner_progress', 'partner_settings',
    'user_topic_progress', 'user_preferences',
}

GENERIC_TABLE_UPDATE_TABLES = {
    'user_profiles', 'user_progress',
    'content_dismissals', 'user_notifications', 'question_states',
    'ad_settings', 'seo_settings', 'seo_expansion_pages',
    'seo_expansion_settings',
    'broadcast_messages',
    'site_announcements', 'site_trust_snippets', 'site_content_blocks',
    'site_verification_codes', 'answer_example_candidates',
    'pdf_download_events', 'promo_codes',
    'partner_connections', 'partner_progress', 'partner_settings',
    'user_topic_progress', 'user_preferences',
}

GENERIC_TABLE_DELETE_TABLES = {
    'content_dismissals', 'site_announcements', 'site_trust_snippets',
    'site_content_blocks', 'broadcast_messages', 'promo_codes',
    'answer_example_candidates', 'partner_connections',
    'partner_progress', 'partner_settings', 'user_notifications',
}

GENERIC_TABLE_ADMIN_WRITE_TABLES = {
    'broadcast_messages', 'site_announcements', 'site_trust_snippets',
    'site_content_blocks', 'site_verification_codes', 'promo_codes',
    'pdf_download_events', 'answer_example_candidates',
    'ad_settings', 'seo_settings', 'seo_expansion_pages', 'seo_expansion_settings',
}

GENERIC_TABLE_READ_COLUMNS = {
    'users': {'id', 'email', 'created_at', 'updated_at', 'last_sign_in_at'},
}

GENERIC_TABLE_USER_WRITE_COLUMNS = {
    'user_profiles': {'first_name', 'last_name', 'display_name', 'updated_at'},
    'user_progress': {
        'user_id', 'questions_practiced', 'ai_turns', 'readiness_score',
        'current_streak', 'longest_streak', 'last_practice_date',
        'topic_progress', 'updated_at',
    },
    'content_dismissals': {
        'user_id', 'content_type', 'content_id', 'dismissed_at',
        'placement', 'metadata', 'created_at',
    },
    'content_interactions': {
        'user_id', 'content_type', 'content_id', 'interaction_type',
        'placement', 'session_id', 'user_agent_hash', 'metadata', 'created_at',
    },
    'referral_events': {
        'user_id', 'promo_code', 'referrer', 'landing_page',
        'event_type', 'metadata', 'created_at',
    },
    'question_states': {
        'user_id', 'question_id', 'topic_id', 'comfort_status',
        'is_saved_for_later', 'last_reviewed_at', 'created_at', 'updated_at',
    },
    'user_notifications': {'user_id', 'is_read', 'dismissed_at', 'updated_at'},
    'partner_connections': {
        'user_id', 'partner_id', 'status', 'partner_email', 'partner_name',
        'accepted_at', 'disconnected_at',
    },
    'partner_progress': {
        'user_id', 'question_states', 'current_topic', 'last_updated',
    },
    'partner_settings': {
        'user_id', 'share_progress', 'share_saved_questions', 'share_stats',
        'allow_partner_answers', 'updated_at',
    },
    'user_topic_progress': {
        'user_id', 'topic_id', 'current_question_index',
        'is_completed', 'created_at', 'updated_at',
    },
    'user_preferences': {'user_id', 'preferences', 'created_at', 'updated_at'},
}

GENERIC_TABLE_ADMIN_WRITE_COLUMNS = {
    **GENERIC_TABLE_USER_WRITE_COLUMNS,
    'user_profiles': {
        'email', 'first_name', 'last_name', 'display_name',
        'role', 'is_active', 'updated_at',
    },
    'broadcast_messages': {
        'title', 'message', 'audience_type', 'is_active', 'sent_count',
        'scheduled_at', 'send_email', 'metadata', 'created_by', 'updated_at',
    },
    'site_announcements': {
        'title', 'body', 'announcement_type', 'placement', 'target_audience',
        'status', 'priority', 'is_dismissible', 'cta_text', 'cta_link',
        'starts_at', 'ends_at', 'created_by', 'updated_by', 'updated_at',
        'view_count',
    },
    'site_trust_snippets': {
        'title', 'subtitle', 'icon_name', 'placement', 'target_audience',
        'status', 'priority', 'cta_text', 'cta_link', 'starts_at', 'ends_at',
        'created_by', 'updated_by', 'updated_at', 'view_count',
    },
    'site_content_blocks': {
        'title', 'body', 'block_type', 'group_key', 'group_order', 'placement',
        'target_audience', 'status', 'priority', 'cta_text', 'cta_link',
        'starts_at', 'ends_at', 'created_by', 'updated_by', 'updated_at',
        'view_count',
    },
    'site_verification_codes': {
        'placement', 'code', 'is_enabled', 'notes', 'environment',
        'created_by', 'updated_by', 'updated_at',
    },
    'answer_example_candidates': {
        'user_id', 'question_id', 'question_slug', 'question_prompt',
        'original_answer', 'sanitized_answer', 'category', 'answer_pattern',
        'quality_score', 'quality_reason', 'review_status', 'reviewer_notes',
        'reviewed_by', 'reviewed_at', 'approved_for_publication',
        'published_at', 'published_slug', 'source_session_id',
        'source_turn_number', 'updated_at',
    },
    'pdf_download_events': {
        'user_id', 'user_email', 'pdf_filename', 'pdf_title', 'topic_id',
        'category_id', 'download_source', 'event_status', 'delivery_method',
        'access_granted', 'session_hash', 'user_agent_hash',
    },
    'promo_codes': {
        'code', 'description', 'discount_percent', 'influencer_name',
        'is_active', 'updated_at',
    },
    'ad_settings': {'id', 'settings', 'updated_at'},
    'seo_settings': {'id', 'sitemap_frequency', 'updated_at'},
    'seo_expansion_settings': {
        'id', 'pattern_pages_enabled', 'situation_pages_enabled',
        'include_in_sitemap', 'noindex_until_approved',
        'recommended_activation_months', 'scheduler_enabled',
        'scheduler_frequency', 'scheduler_page_count_mode',
        'scheduler_fixed_page_count', 'scheduler_random_min_pages',
        'scheduler_random_max_pages', 'scheduler_only_publish_approved',
        'scheduler_auto_include_in_sitemap', 'launch_date',
        'reminder_banner_enabled', 'admin_notes', 'last_sitemap_sync_at',
        'last_deploy_triggered_at', 'last_deploy_status', 'updated_at',
        'updated_by',
    },
    'seo_expansion_pages': {
        'slug', 'page_type', 'parent_cluster', 'status', 'is_enabled',
        'is_published', 'include_in_sitemap', 'noindex_override',
        'sitemap_synced_at', 'is_in_live_sitemap', 'reviewed_at',
        'reviewed_by', 'approved_at', 'approved_by', 'published_at',
        'published_by', 'unpublished_at', 'unpublished_by', 'notes',
        'view_count', 'updated_at',
    },
}

GENERIC_TABLE_CONFLICT_COLUMNS = {
    'user_progress': {'user_id'},
    'question_states': {'user_id', 'question_id'},
    'user_topic_progress': {'user_id', 'topic_id'},
    'user_preferences': {'user_id'},
    'content_dismissals': {'user_id', 'content_type', 'content_id'},
    'partner_connections': {'user_id', 'partner_id'},
    'partner_progress': {'user_id'},
    'partner_settings': {'user_id'},
    'ad_settings': {'id'},
    'seo_settings': {'id'},
    'seo_expansion_settings': {'id'},
    'site_verification_codes': {'placement', 'environment'},
    'promo_codes': {'code'},
}

GENERIC_TABLE_RETIRED_WRITE_TABLES = {
    'refund_requests',
    'support_tickets',
    'user_subscriptions',
}

GENERIC_TABLE_FILTER_OPS = {'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'in', 'is'}


def _is_admin_user(user):
    return bool(user and user.get('role') in ('admin', 'superadmin'))


def _validate_identifier(value, label='identifier'):
    text = str(value or '').strip()
    if not SAFE_SQL_IDENTIFIER_RE.fullmatch(text):
        raise ValueError(f'Invalid {label}')
    return text


def _quote_identifier(value):
    return f'"{_validate_identifier(value)}"'


def _allowed_columns_for_table(table_name):
    table_name = _validate_identifier(table_name, 'table name')
    cached = _TABLE_COLUMN_CACHE.get(table_name)
    if cached is not None:
        return cached

    rows = db.query_all(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = %s
        """,
        (table_name,),
    )
    columns = {row.get('column_name') for row in rows if row.get('column_name')}
    _TABLE_COLUMN_CACHE[table_name] = columns
    return columns


def _allowed_columns_for_operation(table_name, operation, *, is_admin=False):
    table_name = _validate_identifier(table_name, 'table name')
    schema_columns = _allowed_columns_for_table(table_name)

    if operation == 'read':
        policy_columns = GENERIC_TABLE_READ_COLUMNS.get(table_name)
        return schema_columns if policy_columns is None else schema_columns & policy_columns

    if operation in ('insert', 'update'):
        policy = (
            GENERIC_TABLE_ADMIN_WRITE_COLUMNS
            if is_admin
            else GENERIC_TABLE_USER_WRITE_COLUMNS
        )
        policy_columns = policy.get(table_name)
        return schema_columns & policy_columns if policy_columns else set()

    if operation == 'conflict':
        policy_columns = GENERIC_TABLE_CONFLICT_COLUMNS.get(table_name)
        return schema_columns & policy_columns if policy_columns else set()

    raise ValueError(f'Unsupported column operation {operation}')


def _validate_column(table_name, column_name, label='column'):
    column = _validate_identifier(column_name, label)
    if column not in _allowed_columns_for_table(table_name):
        raise ValueError(f'Column {column} is not allowed for {table_name}')
    return column


def _quote_column(table_name, column_name, label='column'):
    return _quote_identifier(_validate_column(table_name, column_name, label))


def _validate_column_for_operation(table_name, column_name, operation, *, is_admin=False, label='column'):
    column = _validate_identifier(column_name, label)
    allowed_columns = _allowed_columns_for_operation(table_name, operation, is_admin=is_admin)
    if column not in allowed_columns:
        raise ValueError(f'Column {column} is not allowed for {table_name}')
    return column


def _quote_column_for_operation(table_name, column_name, operation, *, is_admin=False, label='column'):
    return _quote_identifier(
        _validate_column_for_operation(
            table_name,
            column_name,
            operation,
            is_admin=is_admin,
            label=label,
        )
    )


def _parse_select_clause(table_name, select_value, *, is_admin=False):
    raw = str(select_value or '*').strip()
    allowed_columns = _allowed_columns_for_operation(table_name, 'read', is_admin=is_admin)
    if raw == '*':
        if not allowed_columns:
            raise ValueError(f'No readable columns are allowed for {table_name}')
        return ', '.join(_quote_identifier(column) for column in sorted(allowed_columns))
    columns = []
    for part in raw.split(','):
        column = part.strip()
        if not column:
            continue
        columns.append(
            _quote_column_for_operation(
                table_name,
                column,
                'read',
                is_admin=is_admin,
                label='select column',
            )
        )
    if not columns:
        raise ValueError('At least one select column is required')
    return ', '.join(columns)


def _parse_generic_filters(filters_json):
    if not filters_json:
        return []
    try:
        parsed_filters = json.loads(filters_json)
    except (json.JSONDecodeError, TypeError):
        raise ValueError('filters must be a JSON array')
    if not isinstance(parsed_filters, list):
        raise ValueError('filters must be a JSON array')
    for filter_item in parsed_filters:
        if not isinstance(filter_item, dict):
            raise ValueError('filters entries must be objects')
        op = filter_item.get('op', 'eq')
        if op not in GENERIC_TABLE_FILTER_OPS:
            raise ValueError(f'Unsupported filter op {op}')
    return parsed_filters


def _request_client_metadata(extra=None):
    metadata = {
        'referrer': request.headers.get('Referer', '')[:500],
        'userAgentHash': _hash_header_value(request.headers.get('User-Agent')),
    }
    if isinstance(extra, dict):
        for key, value in extra.items():
            if value is not None:
                metadata[str(key)[:80]] = str(value)[:700]
    return metadata


def _pdf_offer_fingerprint(settings, source):
    basis = json_dumps({
        'source': source,
        'title': settings.get('title') or '',
        'bodyHtml': settings.get('bodyHtml') or '',
        'ctaUrl': settings.get('ctaUrl') or '',
        'ctaLabel': settings.get('ctaLabel') or '',
        'continueLabel': settings.get('continueLabel') or '',
        'frequency': settings.get('frequency') or '',
    })
    return hashlib.sha256(basis.encode('utf-8')).hexdigest()[:24]


def _ensure_pdf_offer_analytics_table():
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS pdf_download_offer_events (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            offer_id TEXT NOT NULL,
            source TEXT NOT NULL,
            event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'cta_click', 'body_link_click', 'dismissed', 'continued')),
            user_id UUID REFERENCES users(id) ON DELETE SET NULL,
            target_url TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_pdf_offer_events_offer_source_created ON pdf_download_offer_events(offer_id, source, created_at DESC)"
    )
    db.execute(
        "CREATE INDEX IF NOT EXISTS idx_pdf_offer_events_event_created ON pdf_download_offer_events(event_type, created_at DESC)"
    )


def _free_app_workflow_retired_response(workflow='workflow'):
    return jsonify({
        'success': False,
        'code': 'FREE_APP_WORKFLOW_RETIRED',
        'error': f'The legacy {workflow} workflow is retired in the free app.',
        'message': (
            'Use dashboard messages, broadcasts, sponsor resources, and the simple contact email '
            'instead of the old ticket/refund/payment workflow.'
        ),
    }), 410


def _mask_secret(value):
    value = str(value or '')
    if not value:
        return ''
    if len(value) <= 8:
        return '••••'
    return f"{value[:4]}••••{value[-4:]}"


AI_ROLE_DEFAULTS = {
    'robin': {
        'label': 'Robin Interview Coach',
        'routingPolicy': 'complexity',
        'enabledModelRefs': [],
        'fallbackModelRefs': [],
        'defaultModelRef': '',
        'fallbackTimeoutSeconds': 25,
    },
    'support': {
        'label': 'User Support Assistant',
        'routingPolicy': 'support_triage',
        'enabledModelRefs': [],
        'fallbackModelRefs': [],
        'defaultModelRef': '',
        'fallbackTimeoutSeconds': 15,
    },
    'admin_support': {
        'label': 'Admin Support Drafts',
        'routingPolicy': 'admin_triage',
        'enabledModelRefs': [],
        'fallbackModelRefs': [],
        'defaultModelRef': '',
        'fallbackTimeoutSeconds': 25,
    },
}

AI_FALLBACK_TIMEOUT_MIN = 8
AI_FALLBACK_TIMEOUT_MAX = 120


def _sanitize_fallback_timeout(value, default_value):
    try:
        seconds = int(value)
    except (TypeError, ValueError):
        seconds = int(default_value)
    return max(AI_FALLBACK_TIMEOUT_MIN, min(AI_FALLBACK_TIMEOUT_MAX, seconds))


def _sanitize_string_list(value, max_items=120):
    if isinstance(value, str):
        value = [item.strip() for item in value.split(',') if item.strip()]
    if not isinstance(value, list):
        return []
    cleaned = []
    for item in value:
        text = str(item or '').strip()
        if text and text not in cleaned:
            cleaned.append(text[:220])
        if len(cleaned) >= max_items:
            break
    return cleaned


def _sanitize_model_catalog(value):
    if not isinstance(value, dict):
        return {}
    catalog = {}
    for provider_id, models in value.items():
        provider_key = _normalize_provider_id(provider_id)
        if provider_key:
            catalog[provider_key] = _sanitize_string_list(models, 200)
    return catalog


def _public_role_assignments(config=None):
    config = config if isinstance(config, dict) else saved_ai_runtime_config()
    raw_roles = config.get('roleAssignments') if isinstance(config.get('roleAssignments'), dict) else {}
    roles = {}
    for role_id, defaults in AI_ROLE_DEFAULTS.items():
        role_config = raw_roles.get(role_id) if isinstance(raw_roles, dict) else {}
        role_config = role_config if isinstance(role_config, dict) else {}
        enabled = _sanitize_string_list(role_config.get('enabledModelRefs'))
        default_ref = str(role_config.get('defaultModelRef') or '').strip()
        if not default_ref:
            provider = str(role_config.get('defaultProvider') or '').strip()
            model = str(role_config.get('defaultModel') or '').strip()
            if provider and model:
                default_ref = f'{provider}::{model}'
        roles[role_id] = {
            **defaults,
            'label': str(role_config.get('label') or defaults['label']).strip()[:80],
            'routingPolicy': str(role_config.get('routingPolicy') or defaults['routingPolicy']).strip()[:80],
            'defaultModelRef': default_ref[:260],
            'enabledModelRefs': enabled,
            'fallbackModelRefs': _sanitize_string_list(role_config.get('fallbackModelRefs')) or [
                item for item in enabled if item != default_ref
            ],
            'fallbackTimeoutSeconds': _sanitize_fallback_timeout(
                role_config.get('fallbackTimeoutSeconds') or role_config.get('fallback_timeout_seconds'),
                defaults['fallbackTimeoutSeconds'],
            ),
        }
    return roles


def _public_lawyer_directory_config(config=None):
    raw = config if isinstance(config, dict) else get_admin_setting('lawyer_directory_config', {}) or {}
    lawyers = raw.get('lawyers') if isinstance(raw.get('lawyers'), list) else []
    public_lawyers = []
    for index, lawyer in enumerate(lawyers[:80]):
        if not isinstance(lawyer, dict):
            continue
        name = str(lawyer.get('name') or '').strip()
        if not name:
            continue
        try:
            priority = int(lawyer.get('priority') or index + 1)
        except Exception:
            priority = index + 1
        public_lawyers.append({
            'id': str(lawyer.get('id') or f'lawyer-{index + 1}')[:80],
            'active': bool(lawyer.get('active', True)),
            'name': name[:120],
            'firm': str(lawyer.get('firm') or '')[:160],
            'states': str(lawyer.get('states') or '')[:180],
            'practiceAreas': str(lawyer.get('practiceAreas') or '')[:240],
            'description': str(lawyer.get('description') or '')[:700],
            'website': str(lawyer.get('website') or '')[:400],
            'affiliateUrl': str(lawyer.get('affiliateUrl') or '')[:500],
            'imageUrl': str(lawyer.get('imageUrl') or '')[:500],
            'email': str(lawyer.get('email') or '')[:180],
            'phone': str(lawyer.get('phone') or '')[:80],
            'priority': priority,
        })
    public_lawyers.sort(key=lambda item: (not item.get('active'), item.get('priority') or 999))
    return {
        'enabled': bool(raw.get('enabled', False)),
        'introText': str(raw.get('introText') or 'Robin can share admin-approved immigration lawyer resources when a user asks for attorney help.')[:500],
        'affiliateDisclosure': str(raw.get('affiliateDisclosure') or 'Some lawyer links may be affiliate links. Spouse Interview is not a law firm and does not provide legal advice.')[:500],
        'lawyers': public_lawyers,
    }


def _public_ai_runtime_config(config=None):
    config = config if isinstance(config, dict) else saved_ai_runtime_config()
    providers = config.get('providers') if isinstance(config.get('providers'), dict) else {}
    public_providers = {}
    for provider_id, provider_config in providers.items():
        if not isinstance(provider_config, dict):
            continue
        api_key = provider_config.get('apiKey') or provider_config.get('api_key') or ''
        public_providers[provider_id] = {
            **{k: v for k, v in provider_config.items() if k not in {'apiKey', 'api_key'}},
            'apiKeyConfigured': bool(api_key),
            'apiKeyMasked': _mask_secret(api_key),
        }
    model_catalog = _sanitize_model_catalog(config.get('modelCatalog'))
    model_catalog.setdefault('minimax', MINIMAX_MODEL_CATALOG)
    return {
        'defaultProvider': config.get('defaultProvider') or config.get('default_provider') or '',
        'defaultModel': config.get('defaultModel') or config.get('default_model') or '',
        'fallbackProviders': config.get('fallbackProviders') or config.get('fallback_providers') or [],
        'providers': public_providers,
        'modelCatalog': model_catalog,
        'roleAssignments': _public_role_assignments(config),
    }


def _create_dashboard_message(user_id, title, message, metadata=None, send_email=False):
    user_row = db.query_one("SELECT email FROM users WHERE id = %s", (user_id,))
    if not user_row:
        return False
    notification_id = db.call_function('create_user_notification', (
        user_id,
        'broadcast',
        title,
        message,
        '/messages',
        json_dumps({
            **(metadata or {}),
            'rich_content': True,
            'direct_message': True,
        }),
    ))
    if send_email and user_row.get('email'):
        try:
            send_dashboard_message_email(user_row['email'], title, message, None, str(notification_id or user_id))
        except Exception:
            pass
    return True


def _csv_safe_cell(value):
    if value is None:
        return ''
    if isinstance(value, bool):
        text = 'yes' if value else 'no'
    elif isinstance(value, (dict, list)):
        text = json_dumps(value if isinstance(value, dict) else {'items': value})
    else:
        text = str(value)
    normalized = text.lstrip()
    if normalized.startswith(('=', '+', '-', '@', '\t', '\r', '\n')):
        return f"'{text}"
    return text


def _csv_response(filename, headers, rows):
    output = io.StringIO(newline='')
    writer = csv.writer(output, quoting=csv.QUOTE_ALL, lineterminator='\r\n')
    writer.writerow([_csv_safe_cell(header) for header in headers])
    for row in rows:
        writer.writerow([_csv_safe_cell(cell) for cell in row])
    return Response(
        output.getvalue(),
        mimetype='text/csv; charset=utf-8',
        headers={
            'Content-Disposition': f'attachment; filename="{filename}"',
            'Cache-Control': 'no-store',
        },
    )


def _slugify_sponsor_link(value):
    slug = re.sub(r'[^a-z0-9-]+', '-', str(value or '').strip().lower())
    slug = re.sub(r'-{2,}', '-', slug).strip('-')
    return slug[:80] or f"sponsor-{uuid.uuid4().hex[:8]}"


def _valid_external_url(value):
    try:
        parsed = urlparse(str(value or '').strip())
        return parsed.scheme in {'https', 'http'} and bool(parsed.netloc)
    except Exception:
        return False


def _hash_header_value(value):
    text = str(value or '').strip()
    if not text:
        return None
    return hashlib.sha256(text.encode('utf-8')).hexdigest()


def _tracking_url_for_slug(slug):
    frontend_url = str(os.getenv('FRONTEND_URL') or '').rstrip('/')
    if frontend_url:
        return f"{frontend_url}/api/sponsor-links/{slug}/go"
    return f"/api/sponsor-links/{slug}/go"


def _serialize_sponsor_link(row):
    row = row or {}
    slug = row.get('slug') or ''
    created_at = row.get('created_at')
    updated_at = row.get('updated_at')
    last_click_at = row.get('last_click_at')
    return {
        'id': str(row.get('id') or ''),
        'slug': slug,
        'title': row.get('title') or '',
        'sponsorName': row.get('sponsor_name') or '',
        'destinationUrl': row.get('destination_url') or '',
        'disclosureLabel': row.get('disclosure_label') or 'Sponsored Resource',
        'notes': row.get('notes') or '',
        'isActive': bool(row.get('is_active', True)),
        'clickCount': int(row.get('click_count') or 0),
        'uniqueUsers': int(row.get('unique_users') or 0),
        'lastClickAt': last_click_at.isoformat() if hasattr(last_click_at, 'isoformat') else last_click_at,
        'trackingUrl': _tracking_url_for_slug(slug),
        'createdBy': str(row.get('created_by') or '') or None,
        'createdAt': created_at.isoformat() if hasattr(created_at, 'isoformat') else created_at,
        'updatedAt': updated_at.isoformat() if hasattr(updated_at, 'isoformat') else updated_at,
    }


@api_bp.route('/rpc/<func_name>', methods=['POST'])
@optional_auth
def call_rpc(func_name):
    user = request.current_user
    data = request.get_json() or {}

    allowed_functions = {
        'is_admin', 'is_superadmin',
        'get_effective_subscription', 'check_ai_usage_limits',
        'record_ai_session_start', 'record_ai_turn',
        'create_or_update_subscription',
        'record_pdf_download', 'get_user_download_summary',
        'get_user_download_events',
        'get_active_announcements', 'get_active_trust_snippets',
        'get_active_content_blocks', 'get_dismissed_content_ids',
        'dismiss_content', 'record_content_interaction',
        'get_content_analytics', 'get_placement_analytics',
        'get_seo_settings', 'update_sitemap_frequency',
        'get_seo_expansion_settings', 'save_seo_expansion_settings',
        'get_published_expansion_slugs', 'get_seo_expansion_pages',
        'update_seo_expansion_page_status',
        'bulk_update_seo_expansion_pages',
        'increment_expansion_page_views',
        'record_scheduler_run', 'record_rebuild_attempt',
        'get_latest_rebuild_attempt', 'get_scheduler_run_history',
        'get_sitemap_sync_status_secure',
        'validate_promo_code', 'record_referral_event',
        'get_all_promo_code_stats', 'apply_promo_code_discount',
        'get_promo_code_stats',
        'create_answer_candidate', 'get_pending_answer_candidates',
        'update_answer_candidate_review', 'get_answer_candidate_stats',
        'get_unread_notification_count', 'mark_notification_read',
        'publish_broadcast', 'create_support_ticket',
        'get_user_tickets_with_replies', 'get_open_tickets_for_admin',
        'reply_to_support_ticket', 'create_refund_request',
        'get_refund_request_with_download_summary',
        'process_refund_approval', 'deny_refund_request',
        'get_pending_refund_requests',
        'get_verification_code', 'upsert_verification_code',
        'soft_delete_user', 'get_user_profile',
        'has_premium_access',
        'increment_download', 'reset_stats',
        'process-refund', 'trigger-rebuild',
    }

    if func_name not in allowed_functions:
        return jsonify({'error': f'Function {func_name} not found'}), 404

    if func_name in RETIRED_FREE_APP_RPC_FUNCTIONS:
        return _free_app_workflow_retired_response(func_name.replace('_', ' '))

    admin_only_functions = {
        'update_sitemap_frequency', 'update_seo_expansion_page_status',
        'record_scheduler_run', 'record_rebuild_attempt',
        'get_all_promo_code_stats', 'apply_promo_code_discount',
        'get_promo_code_stats', 'save_seo_expansion_settings',
        'bulk_update_seo_expansion_pages', 'get_seo_expansion_pages',
        'get_pending_answer_candidates', 'update_answer_candidate_review',
        'get_answer_candidate_stats', 'publish_broadcast',
        'get_open_tickets_for_admin', 'reply_to_support_ticket',
        'get_refund_request_with_download_summary',
        'process_refund_approval', 'deny_refund_request',
        'get_pending_refund_requests',
        'upsert_verification_code', 'reset_stats',
        'get_content_analytics', 'get_placement_analytics',
        'get_scheduler_run_history',
        'process-refund', 'trigger-rebuild',
    }

    auth_required_functions = {
        'is_admin', 'is_superadmin', 'get_effective_subscription',
        'check_ai_usage_limits', 'record_ai_session_start', 'record_ai_turn',
        'create_or_update_subscription', 'record_pdf_download',
        'get_user_download_summary', 'get_user_download_events',
        'get_dismissed_content_ids', 'dismiss_content',
        'create_answer_candidate', 'get_unread_notification_count',
        'mark_notification_read', 'create_support_ticket',
        'get_user_tickets_with_replies', 'create_refund_request',
        'soft_delete_user', 'get_user_profile', 'has_premium_access',
        'record_referral_event', 'increment_download',
    }

    if func_name in admin_only_functions:
        if not user or user.get('role') not in ('admin', 'superadmin'):
            return jsonify({'error': 'Admin access required'}), 403

    if func_name in auth_required_functions and not user:
        return jsonify({'error': 'Authentication required'}), 401

    if func_name == 'process-refund':
        return process_refund()
    if func_name == 'trigger-rebuild':
        return trigger_rebuild()
    if func_name == 'get_verification_code':
        return jsonify({
            'data': _enabled_verification_code(
                data.get('placement') or data.get('p_placement'),
                data.get('environment') or data.get('p_environment') or 'production',
            )
        })

    param_mapping = {
        'is_admin': {'p_user_id': lambda: user['id']},
        'is_superadmin': {'p_user_id': lambda: user['id']},
        'get_effective_subscription': {'p_user_id': lambda: user['id']},
        'check_ai_usage_limits': {'p_user_id': lambda: user['id']},
        'record_ai_session_start': {
            'p_user_id': lambda: user['id'],
            'p_provider': lambda: data.get('provider'),
            'p_model': lambda: data.get('model'),
            'p_topic_id': lambda: data.get('topicId'),
        },
        'record_ai_turn': {
            'p_user_id': lambda: user['id'],
            'p_session_id': lambda: data.get('sessionId'),
            'p_turn_count': lambda: data.get('turnCount', 1),
        },
        'dismiss_content': {
            'p_user_id': lambda: user['id'],
            'p_content_type': lambda: data.get('contentType'),
            'p_content_id': lambda: data.get('contentId'),
            'p_placement': lambda: data.get('placement'),
        },
        'get_dismissed_content_ids': {
            'p_user_id': lambda: user['id'],
            'p_content_type': lambda: data.get('contentType'),
            'p_placement': lambda: data.get('placement'),
        },
        'record_pdf_download': {
            'p_user_id': lambda: user['id'],
            'p_user_email': lambda: user.get('email'),
            'p_pdf_filename': lambda: data.get('pdfFilename'),
            'p_pdf_title': lambda: data.get('pdfTitle'),
            'p_topic_id': lambda: data.get('topicId'),
            'p_category_id': lambda: data.get('categoryId'),
            'p_download_source': lambda: data.get('downloadSource', 'topic_page'),
            'p_event_status': lambda: data.get('eventStatus', 'requested'),
            'p_session_hash': lambda: data.get('sessionHash'),
            'p_user_agent_hash': lambda: data.get('userAgentHash'),
        },
        'get_user_download_summary': {'p_user_id': lambda: user['id']},
        'mark_notification_read': {'p_notification_id': lambda: data.get('p_notification_id') or data.get('notificationId')},
        'get_unread_notification_count': {},
        'get_user_tickets_with_replies': {'p_user_id': lambda: user['id']},
        'create_support_ticket': {
            'p_user_id': lambda: user['id'],
            'p_subject': lambda: data.get('p_subject') or data.get('subject'),
            'p_category': lambda: data.get('p_category') or data.get('category', 'other'),
            'p_message': lambda: data.get('p_message') or data.get('message'),
            'p_ai_summary': lambda: data.get('p_ai_summary') or data.get('aiSummary'),
            'p_ai_suggested_reply': lambda: data.get('p_ai_suggested_reply') or data.get('aiSuggestedReply'),
            'p_ai_triage': lambda: (
                json.dumps(data.get('p_ai_triage') or data.get('aiTriage') or {})
                if isinstance(data.get('p_ai_triage') or data.get('aiTriage'), dict)
                else (data.get('p_ai_triage') or data.get('aiTriage') or '{}')
            ),
        },
        'create_refund_request': {
            'p_user_id': lambda: user['id'],
            'p_subscription_id': lambda: data.get('p_subscription_id') or data.get('subscriptionId'),
            'p_stripe_payment_intent_id': lambda: data.get('p_stripe_payment_intent_id') or data.get('stripePaymentIntentId'),
            'p_stripe_charge_id': lambda: data.get('p_stripe_charge_id') or data.get('stripeChargeId'),
            'p_plan_type': lambda: data.get('p_plan_type') or data.get('planType'),
            'p_amount': lambda: data.get('p_amount') or data.get('amount'),
            'p_currency': lambda: data.get('p_currency') or data.get('currency', 'usd'),
            'p_purchased_at': lambda: data.get('p_purchased_at') or data.get('purchasedAt'),
            'p_days_since_purchase': lambda: data.get('p_days_since_purchase') or data.get('daysSincePurchase', 0),
            'p_questions_completed': lambda: data.get('p_questions_completed') or data.get('questionsCompleted', 0),
            'p_mock_interviews_completed': lambda: data.get('p_mock_interviews_completed') or data.get('mockInterviewsCompleted', 0),
            'p_reason': lambda: data.get('p_reason') or data.get('reason'),
            'p_additional_comments': lambda: data.get('p_additional_comments') or data.get('additionalComments'),
        },
        'validate_promo_code': {'p_code': lambda: data.get('code')},
        'record_referral_event': {
            'p_user_id': lambda: user['id'] if user else data.get('userId'),
            'p_promo_code': lambda: data.get('promoCode'),
            'p_referrer': lambda: data.get('referrer'),
            'p_landing_page': lambda: data.get('landingPage'),
            'p_event_type': lambda: data.get('eventType', 'visit'),
            'p_metadata': lambda: json.dumps(data.get('metadata', {})) if isinstance(data.get('metadata'), dict) else data.get('metadata', '{}'),
        },
        'increment_expansion_page_views': {'p_slug': lambda: data.get('slug')},
    'update_seo_expansion_page_status': {
      'p_slug': lambda: data.get('slug'),
      'p_status': lambda: data.get('status'),
      'p_include_in_sitemap': lambda: data.get('includeInSitemap', False),
      'p_noindex_override': lambda: data.get('noindexOverride', True),
      'p_notes': lambda: data.get('notes'),
    },
    'get_seo_expansion_pages': {
      'p_status': lambda: data.get('status'),
      'p_limit': lambda: data.get('limit', 100),
      'p_offset': lambda: data.get('offset', 0),
    },
        'record_scheduler_run': {
            'p_triggered_manually': lambda: data.get('triggeredManually', True),
            'p_pages_considered': lambda: data.get('pagesConsidered', 0),
            'p_pages_published': lambda: data.get('pagesPublished', 0),
            'p_published_slugs': lambda: data.get('publishedSlugs', []),
            'p_sitemap_included': lambda: data.get('sitemapIncluded', False),
            'p_noindex_respected': lambda: data.get('noindexRespected', True),
            'p_only_approved_published': lambda: data.get('onlyApprovedPublished', True),
            'p_execution_duration_ms': lambda: data.get('executionDurationMs'),
            'p_error_message': lambda: data.get('errorMessage'),
        },
        'record_rebuild_attempt': {
            'p_triggered_by': lambda: user['id'] if user else data.get('triggeredBy'),
            'p_triggered_at': lambda: data.get('triggeredAt'),
            'p_status': lambda: data.get('status', 'pending'),
            'p_reason': lambda: data.get('reason', 'admin_triggered'),
            'p_source': lambda: data.get('source', 'admin_dashboard'),
            'p_error': lambda: data.get('error'),
        },
        'create_answer_candidate': {
            'p_user_id': lambda: data.get('userId', user['id'] if user else None),
            'p_question_id': lambda: data.get('questionId'),
            'p_question_slug': lambda: data.get('questionSlug'),
            'p_question_prompt': lambda: data.get('questionPrompt'),
            'p_original_answer': lambda: data.get('originalAnswer'),
            'p_sanitized_answer': lambda: data.get('sanitizedAnswer'),
            'p_category': lambda: data.get('category', 'uncategorized'),
            'p_answer_pattern': lambda: data.get('answerPattern', 'other'),
            'p_quality_score': lambda: data.get('qualityScore', 'uncategorized'),
            'p_quality_reason': lambda: data.get('qualityReason'),
            'p_source_session_id': lambda: data.get('sourceSessionId'),
            'p_source_turn_number': lambda: data.get('sourceTurnNumber'),
        },
        'update_answer_candidate_review': {
            'p_candidate_id': lambda: data.get('candidateId'),
            'p_review_status': lambda: data.get('reviewStatus'),
            'p_reviewer_notes': lambda: data.get('reviewerNotes'),
            'p_approved_for_publication': lambda: data.get('approvedForPublication', False),
        },
        'get_verification_code': {
            'p_placement': lambda: data.get('placement'),
            'p_environment': lambda: data.get('environment', 'production'),
        },
        'upsert_verification_code': {
            'p_placement': lambda: data.get('placement'),
            'p_code': lambda: data.get('code'),
            'p_is_enabled': lambda: data.get('isEnabled', True),
            'p_notes': lambda: data.get('notes'),
            'p_environment': lambda: data.get('environment', 'production'),
        },
        'has_premium_access': {'p_user_id': lambda: data.get('p_user_id', user['id'] if user else None)},
        'get_user_profile': {'p_user_id': lambda: user['id']},
    'soft_delete_user': {'p_user_id': lambda: user['id']},
    'get_user_download_events': {
      'p_user_id': lambda: data.get('p_user_id', user['id']),
      'p_limit': lambda: data.get('limit', 50),
      'p_offset': lambda: data.get('offset', 0),
    },
    'get_content_analytics': {
      'p_content_type': lambda: data.get('contentType'),
      'p_start_date': lambda: data.get('startDate'),
      'p_end_date': lambda: data.get('endDate'),
    },
    'get_placement_analytics': {
      'p_placement': lambda: data.get('placement'),
      'p_start_date': lambda: data.get('startDate'),
      'p_end_date': lambda: data.get('endDate'),
    },
    'save_seo_expansion_settings': {
      'p_auto_publish': lambda: data.get('autoPublish', False),
      'p_max_pages_per_run': lambda: data.get('maxPagesPerRun', 5),
      'p_quality_threshold': lambda: data.get('qualityThreshold', 0.7),
      'p_require_approval': lambda: data.get('requireApproval', True),
      'p_default_include_sitemap': lambda: data.get('defaultIncludeSitemap', True),
      'p_default_noindex': lambda: data.get('defaultNoindex', False),
    },
    'bulk_update_seo_expansion_pages': {
      'p_slugs': lambda: data.get('slugs', []),
      'p_status': lambda: data.get('status'),
      'p_include_in_sitemap': lambda: data.get('includeInSitemap'),
      'p_noindex_override': lambda: data.get('noindexOverride'),
    },
    'get_scheduler_run_history': {
      'p_limit': lambda: data.get('limit', 20),
      'p_offset': lambda: data.get('offset', 0),
    },
    'process_refund_approval': {
      'p_refund_request_id': lambda: data.get('refundRequestId'),
      'p_admin_notes': lambda: data.get('adminNotes'),
    },
    'deny_refund_request': {
      'p_refund_request_id': lambda: data.get('refundRequestId'),
      'p_admin_notes': lambda: data.get('adminNotes'),
    },
    'get_pending_refund_requests': {},
    'get_promo_code_stats': {'p_code': lambda: data.get('code')},
    'increment_download': {},
    'reset_stats': {},
  }

    if func_name in param_mapping:
        param_defs = param_mapping[func_name]
        try:
            params = []
            for key, value_fn in param_defs.items():
                params.append(value_fn())
        except Exception as e:
            return jsonify({'error': f'Parameter error: {str(e)}'}), 400
    else:
        params = []
        for key, value in data.items():
            if not key.startswith('_'):
                params.append(value)

    try:
        result = db.call_function(func_name, params if params else None)
        if isinstance(result, list) and len(result) == 1:
            result = result[0]
        return jsonify({'data': result})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Table-based queries (replacing supabase.from() calls)
@api_bp.route('/table/<table_name>', methods=['GET'])
@optional_auth
def query_table(table_name):
    user = request.current_user
    is_admin = _is_admin_user(user)

    if table_name not in GENERIC_TABLE_READ_TABLES:
        return jsonify({'error': f'Table {table_name} not accessible'}), 404

    if table_name in GENERIC_TABLE_ADMIN_READ_TABLES:
        if not is_admin:
            return jsonify({'error': 'Admin access required'}), 403

    if table_name in TABLES_WITH_USER_ID and not user:
        return jsonify({'error': 'Authentication required'}), 401

    select = request.args.get('select', '*')
    filter_col = request.args.get('filter')
    filter_val = request.args.get('filterValue')
    eq_col = request.args.get('eq')
    eq_val = request.args.get('eqValue')
    filters_json = request.args.get('filters')
    order = request.args.get('order')
    limit = request.args.get('limit', type=int)
    single = request.args.get('single', 'false').lower() == 'true'
    if limit is not None:
        limit = max(1, min(limit, 1000))

    try:
        quoted_table = _quote_identifier(table_name)
        select_clause = _parse_select_clause(table_name, select, is_admin=is_admin)
        sql = f"SELECT {select_clause} FROM {quoted_table}"
        conditions = []
        params = []

        if table_name in AUTO_USER_SCOPE_TABLES and not is_admin:
            if 'user_id' not in _allowed_columns_for_table(table_name):
                return jsonify({'error': 'User scoped table is missing user_id'}), 500
            if table_name == 'partner_connections' and 'partner_id' in _allowed_columns_for_table(table_name):
                conditions.append(
                    f"({_quote_column_for_operation(table_name, 'user_id', 'read')} = %s "
                    f"OR {_quote_column_for_operation(table_name, 'partner_id', 'read')} = %s)"
                )
                params.extend([user['id'], user['id']])
            else:
                conditions.append(f"{_quote_column_for_operation(table_name, 'user_id', 'read')} = %s")
                params.append(user['id'])

        if eq_col and eq_val is not None:
            conditions.append(
                f"{_quote_column_for_operation(table_name, eq_col, 'read', label='eq column')} = %s"
            )
            params.append(eq_val)

        if filter_col and filter_val:
            conditions.append(
                f"{_quote_column_for_operation(table_name, filter_col, 'read', label='filter column')} = %s"
            )
            params.append(filter_val)

        for f in _parse_generic_filters(filters_json):
            op = f.get('op', 'eq')
            col = f.get('col')
            val = f.get('val')
            if not col:
                raise ValueError('filters entries must include col')
            quoted_col = _quote_column_for_operation(table_name, col, 'read', label='filter column')
            if op == 'eq':
                conditions.append(f"{quoted_col} = %s")
                params.append(str(val))
            elif op == 'neq':
                conditions.append(f"{quoted_col} != %s")
                params.append(str(val))
            elif op == 'gt':
                conditions.append(f"{quoted_col} > %s")
                params.append(str(val))
            elif op == 'gte':
                conditions.append(f"{quoted_col} >= %s")
                params.append(str(val))
            elif op == 'lt':
                conditions.append(f"{quoted_col} < %s")
                params.append(str(val))
            elif op == 'lte':
                conditions.append(f"{quoted_col} <= %s")
                params.append(str(val))
            elif op == 'like':
                conditions.append(f"{quoted_col} LIKE %s")
                params.append(str(val))
            elif op == 'ilike':
                conditions.append(f"{quoted_col} ILIKE %s")
                params.append(str(val))
            elif op == 'in':
                if not isinstance(val, list):
                    raise ValueError('in filter value must be an array')
                if not val:
                    conditions.append('1 = 0')
                else:
                    placeholders = ', '.join(['%s'] * len(val))
                    conditions.append(f"{quoted_col} IN ({placeholders})")
                    params.extend([str(v) for v in val])
            elif op == 'is':
                if val is None or str(val).lower() == 'null':
                    conditions.append(f"{quoted_col} IS NULL")
                else:
                    raise ValueError('is filter only supports null')

        if conditions:
            sql += " WHERE " + " AND ".join(conditions)

        if order:
            direction = 'DESC' if order.startswith('-') else 'ASC'
            col = order.lstrip('-')
            sql += (
                f" ORDER BY "
                f"{_quote_column_for_operation(table_name, col, 'read', label='order column')} {direction}"
            )

        if single:
            sql += " LIMIT 1"
        elif limit:
            sql += " LIMIT %s"
            params.append(limit)

        rows = db.query_all(sql, params if params else None)
        if single:
            return jsonify({'data': rows[0] if rows else None})
        return jsonify({'data': rows})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/table/<table_name>', methods=['POST'])
@require_auth
def insert_table(table_name):
    user = request.current_user
    is_admin = _is_admin_user(user)
    data = request.get_json()

    if table_name in GENERIC_TABLE_RETIRED_WRITE_TABLES:
        return jsonify({'error': f'Generic writes are retired for {table_name}'}), 410

    if table_name not in GENERIC_TABLE_INSERT_TABLES:
        return jsonify({'error': f'Cannot insert into {table_name}'}), 403

    if table_name in GENERIC_TABLE_ADMIN_WRITE_TABLES and not is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    if isinstance(data, list) and len(data) == 1:
        data = data[0]

    if not isinstance(data, dict) or not data:
        return jsonify({'error': 'Request body must be a non-empty object'}), 400

    if table_name in AUTO_USER_SCOPE_TABLES and not is_admin:
        requested_user_id = str(data.get('user_id') or user['id'])
        if requested_user_id != str(user['id']):
            return jsonify({'error': 'Can only write your own rows'}), 403
        data['user_id'] = user['id']

    if table_name in ('content_dismissals',) and 'user_id' not in data:
        data['user_id'] = user['id']

    is_upsert = request.args.get('upsert', 'false').lower() == 'true'
    on_conflict = request.args.get('onConflict')

    try:
        quoted_table = _quote_identifier(table_name)
        insert_names = [
            _validate_column_for_operation(
                table_name,
                key,
                'insert',
                is_admin=is_admin,
                label='insert column',
            )
            for key in data.keys()
        ]
        columns = ', '.join(_quote_identifier(key) for key in insert_names)
        placeholders = ', '.join(['%s'] * len(data))
        values = list(data.values())
        if is_upsert and on_conflict:
            conflict_names = [
                _validate_column_for_operation(
                    table_name,
                    col.strip(),
                    'conflict',
                    is_admin=is_admin,
                    label='conflict column',
                )
                for col in on_conflict.split(',')
                if col.strip()
            ]
            if not conflict_names:
                return jsonify({'error': 'onConflict must include at least one column'}), 400
            if any(col not in insert_names for col in conflict_names):
                return jsonify({'error': 'onConflict columns must be included in the request body'}), 400
            conflict_cols = ', '.join(_quote_identifier(col) for col in conflict_names)
            update_cols = [key for key in insert_names if key not in conflict_names]
            update_sets = ', '.join(
                f"{_quote_identifier(key)} = EXCLUDED.{_quote_identifier(key)}"
                for key in update_cols
            )
            if update_sets:
                sql = f"INSERT INTO {quoted_table} ({columns}) VALUES ({placeholders}) ON CONFLICT ({conflict_cols}) DO UPDATE SET {update_sets} RETURNING *"
            else:
                sql = f"INSERT INTO {quoted_table} ({columns}) VALUES ({placeholders}) ON CONFLICT ({conflict_cols}) DO NOTHING RETURNING *"
            result = db.execute_returning(sql, values)
        elif is_upsert:
            return jsonify({'error': 'onConflict parameter required for upsert'}), 400
        else:
            result = db.execute_returning(
                f"INSERT INTO {quoted_table} ({columns}) VALUES ({placeholders}) RETURNING *",
                values
            )
        return jsonify({'data': result})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/table/<table_name>', methods=['PATCH'])
@require_auth
def update_table(table_name):
    user = request.current_user
    is_admin = _is_admin_user(user)
    data = request.get_json()

    if table_name in GENERIC_TABLE_RETIRED_WRITE_TABLES:
        return jsonify({'error': f'Generic writes are retired for {table_name}'}), 410

    if table_name not in GENERIC_TABLE_UPDATE_TABLES:
        return jsonify({'error': f'Cannot update {table_name}'}), 403

    if table_name in GENERIC_TABLE_ADMIN_WRITE_TABLES and not is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    eq_col = request.args.get('eq')
    eq_val = request.args.get('eqValue')

    if not eq_col or not eq_val:
        return jsonify({'error': 'eq and eqValue parameters required'}), 400

    if table_name in ('user_profiles',) and eq_col == 'user_id':
        if eq_val != user['id'] and not _is_admin_user(user):
            return jsonify({'error': 'Can only update own profile'}), 403

    if not isinstance(data, dict) or not data:
        return jsonify({'error': 'Request body must be a non-empty object'}), 400

    if table_name in AUTO_USER_SCOPE_TABLES and not is_admin:
        if eq_col == 'user_id' and str(eq_val) != str(user['id']):
            return jsonify({'error': 'Can only update your own rows'}), 403
        requested_user_id = data.get('user_id')
        if requested_user_id and str(requested_user_id) != str(user['id']):
            return jsonify({'error': 'Can only update your own rows'}), 403
        data.pop('user_id', None)
        if not data:
            return jsonify({'error': 'No updatable columns supplied'}), 400

    try:
        quoted_table = _quote_identifier(table_name)
        update_names = [
            _validate_column_for_operation(
                table_name,
                key,
                'update',
                is_admin=is_admin,
                label='update column',
            )
            for key in data.keys()
        ]
        set_clauses = ', '.join(f"{_quote_identifier(k)} = %s" for k in update_names)
        quoted_eq_col = _quote_column_for_operation(table_name, eq_col, 'read', label='eq column')
        values = list(data.values()) + [eq_val]
        scope_clause = ''
        if table_name in AUTO_USER_SCOPE_TABLES and not is_admin:
            scope_clause = f" AND {_quote_column_for_operation(table_name, 'user_id', 'read')} = %s"
            values.append(user['id'])
        result = db.execute_returning(
            f"UPDATE {quoted_table} SET {set_clauses} WHERE {quoted_eq_col} = %s{scope_clause} RETURNING *",
            values
        )
        return jsonify({'data': result})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/table/<table_name>', methods=['DELETE'])
@require_auth
def delete_table(table_name):
    user = request.current_user
    is_admin = _is_admin_user(user)
    eq_col = request.args.get('eq')
    eq_val = request.args.get('eqValue')

    if table_name not in GENERIC_TABLE_DELETE_TABLES:
        return jsonify({'error': f'Cannot delete from {table_name}'}), 403

    admin_only_delete_tables = GENERIC_TABLE_ADMIN_WRITE_TABLES | {
        'site_announcements', 'site_trust_snippets', 'site_content_blocks',
        'broadcast_messages', 'promo_codes', 'answer_example_candidates',
    }
    if table_name in admin_only_delete_tables and not is_admin:
        return jsonify({'error': 'Admin access required'}), 403

    if not eq_col or not eq_val:
        return jsonify({'error': 'eq and eqValue parameters required'}), 400

    try:
        quoted_table = _quote_identifier(table_name)
        quoted_eq_col = _quote_column_for_operation(table_name, eq_col, 'read', label='eq column')
        params = [eq_val]
        scope_clause = ''
        if table_name in AUTO_USER_SCOPE_TABLES and not is_admin:
            scope_clause = f" AND {_quote_column_for_operation(table_name, 'user_id', 'read')} = %s"
            params.append(user['id'])
        db.execute(f"DELETE FROM {quoted_table} WHERE {quoted_eq_col} = %s{scope_clause}", params)
        return jsonify({'data': None})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/admin/system-status', methods=['GET'])
@require_admin
def admin_system_status():
    from datetime import datetime, timezone

    stripe_secret = os.getenv('STRIPE_SECRET_KEY', '')
    stripe_publishable = os.getenv('STRIPE_PUBLISHABLE_KEY', '') or os.getenv('VITE_STRIPE_PUBLISHABLE_KEY', '')
    stripe_webhook = os.getenv('STRIPE_WEBHOOK_SECRET', '')
    plunk_api_key = os.getenv('PLUNK_SECRET_KEY', '') or os.getenv('PLUNK_API_KEY', '')
    resend_api_key = os.getenv('RESEND_API_KEY', '') or os.getenv('RESEND_SECRET_KEY', '')
    email_provider = (os.getenv('EMAIL_PROVIDER') or '').strip().lower()
    if email_provider not in {'resend', 'plunk'}:
        email_provider = 'resend' if resend_api_key else ('plunk' if plunk_api_key else 'dev')
    email_from = os.getenv('RESEND_FROM_EMAIL') or os.getenv('PLUNK_FROM_EMAIL') or os.getenv('EMAIL_FROM') or ''

    if stripe_secret.startswith('sk_test_'):
        stripe_mode = 'test'
    elif stripe_secret.startswith('sk_live_'):
        stripe_mode = 'live'
    elif stripe_secret:
        stripe_mode = 'unknown'
    else:
        stripe_mode = 'not_configured'

    def ai_env_value(*names):
        for name in names:
            value = os.getenv(name, '').strip()
            if value:
                return value
        return ''

    def normalize_provider_id(value):
        provider_id = str(value or '').strip().lower().replace(' ', '_')
        allowed = set('abcdefghijklmnopqrstuvwxyz0123456789_-')
        if not provider_id or any(char not in allowed for char in provider_id):
            return ''
        return provider_id

    def safe_int(value, fallback):
        try:
            return int(value)
        except Exception:
            return fallback

    def compatible_provider_statuses():
        statuses = []
        raw_config = ai_env_value(
            'AI_OPENAI_COMPATIBLE_PROVIDERS',
            'OPENAI_COMPATIBLE_PROVIDERS',
            'CUSTOM_LLM_PROVIDERS',
        )
        if not raw_config:
            return statuses

        try:
            parsed = json.loads(raw_config)
        except Exception:
            return statuses

        entries = parsed.get('providers') if isinstance(parsed, dict) else parsed
        if not isinstance(entries, list):
            return statuses

        reserved = {'openai', 'anthropic', 'deepseek', 'nvidia', 'fallback', 'unified', 'minimax'}
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            provider_id = normalize_provider_id(entry.get('provider') or entry.get('id'))
            if not provider_id or provider_id in reserved:
                continue

            api_key_env = entry.get('apiKeyEnvVar') or entry.get('apiKeyEnv') or f'{provider_id.upper()}_API_KEY'
            base_url_env = entry.get('baseUrlEnvVar') or entry.get('baseUrlEnv') or f'{provider_id.upper()}_BASE_URL'
            default_model_env = (
                entry.get('defaultModelEnvVar')
                or entry.get('defaultModelEnv')
                or f'{provider_id.upper()}_DEFAULT_MODEL'
            )
            api_key_configured = bool(ai_env_value(api_key_env) or entry.get('apiKey'))
            base_url = ai_env_value(base_url_env) or str(entry.get('baseUrl') or entry.get('base_url') or '')
            default_model = ai_env_value(default_model_env) or str(entry.get('defaultModel') or 'auto')
            models = entry.get('models') if isinstance(entry.get('models'), list) else []
            statuses.append({
                'provider': provider_id,
                'label': str(entry.get('label') or provider_id.replace('_', ' ').title()),
                'configured': api_key_configured and bool(base_url),
                'defaultModel': default_model,
                'modelCount': len(models) or safe_int(entry.get('modelCount'), 1),
                'apiKeyConfigured': api_key_configured,
                'baseUrlConfigured': bool(base_url),
                'baseUrl': base_url,
                'apiKeyEnvVar': api_key_env,
                'baseUrlEnvVar': base_url_env,
                'defaultModelEnvVar': default_model_env,
                'openAICompatible': True,
                'configurationHint': 'OpenAI-compatible provider from AI_OPENAI_COMPATIBLE_PROVIDERS.',
            })
        return statuses

    unified_key = ai_env_value('UNIFIED_LLM_API_KEY', 'FREELLM_API_KEY', 'OPENAI_COMPATIBLE_API_KEY')
    unified_base_url = ai_env_value('UNIFIED_LLM_BASE_URL', 'FREELLM_BASE_URL', 'OPENAI_COMPATIBLE_BASE_URL')
    unified_default_model = ai_env_value(
        'UNIFIED_LLM_DEFAULT_MODEL',
        'FREELLM_DEFAULT_MODEL',
        'OPENAI_COMPATIBLE_DEFAULT_MODEL',
        'AI_DEFAULT_MODEL',
    ) or 'auto'

    minimax = _openai_compatible_provider('minimax') or {}
    providers = [
        {
            'provider': 'unified',
            'label': 'Unified LLM Proxy',
            'configured': bool(unified_key and unified_base_url),
            'defaultModel': unified_default_model,
            'modelCount': safe_int(os.getenv('UNIFIED_LLM_MODEL_COUNT', '3'), 3),
            'apiKeyConfigured': bool(unified_key),
            'baseUrlConfigured': bool(unified_base_url),
            'baseUrl': unified_base_url,
            'apiKeyEnvVar': 'UNIFIED_LLM_API_KEY',
            'baseUrlEnvVar': 'UNIFIED_LLM_BASE_URL',
            'defaultModelEnvVar': 'UNIFIED_LLM_DEFAULT_MODEL',
            'openAICompatible': True,
            'configurationHint': 'Use this for OpenAI-compatible gateways, routers, and self-hosted LLM proxies.',
        },
        {
            'provider': 'minimax',
            'label': 'MiniMax',
            'configured': bool(minimax.get('api_key') and minimax.get('base_url')),
            'defaultModel': minimax.get('default_model') or os.getenv('MINIMAX_DEFAULT_MODEL', 'MiniMax-M3'),
            'modelCount': len(MINIMAX_MODEL_CATALOG),
            'apiKeyConfigured': bool(minimax.get('api_key')),
            'baseUrlConfigured': bool(minimax.get('base_url')),
            'baseUrl': minimax.get('base_url') or os.getenv('MINIMAX_BASE_URL', 'https://api.minimax.io/v1'),
            'apiKeyEnvVar': 'MINIMAX_API_KEY',
            'baseUrlEnvVar': 'MINIMAX_BASE_URL',
            'defaultModelEnvVar': 'MINIMAX_DEFAULT_MODEL',
            'openAICompatible': True,
            'configurationHint': 'MiniMax OpenAI-compatible chat completions. Default local model: MiniMax-M3.',
        },
        {
            'provider': 'openai',
            'label': 'OpenAI',
            'configured': bool(os.getenv('OPENAI_API_KEY')),
            'defaultModel': os.getenv('OPENAI_DEFAULT_MODEL', 'gpt-5-mini'),
            'modelCount': 3,
            'apiKeyEnvVar': 'OPENAI_API_KEY',
        },
        {
            'provider': 'anthropic',
            'label': 'Anthropic',
            'configured': bool(os.getenv('ANTHROPIC_API_KEY')),
            'defaultModel': os.getenv('ANTHROPIC_DEFAULT_MODEL', 'claude-3-haiku-20240307'),
            'modelCount': 3,
            'apiKeyEnvVar': 'ANTHROPIC_API_KEY',
        },
        {
            'provider': 'deepseek',
            'label': 'DeepSeek',
            'configured': bool(os.getenv('DEEPSEEK_API_KEY')),
            'defaultModel': os.getenv('DEEPSEEK_DEFAULT_MODEL', 'deepseek-chat'),
            'modelCount': 2,
            'apiKeyEnvVar': 'DEEPSEEK_API_KEY',
        },
        {
            'provider': 'nvidia',
            'label': 'NVIDIA',
            'configured': bool(os.getenv('NVIDIA_API_KEY')),
            'defaultModel': os.getenv('NVIDIA_DEFAULT_MODEL', 'meta/llama-3.1-8b-instruct'),
            'modelCount': 3,
            'apiKeyEnvVar': 'NVIDIA_API_KEY',
        },
    ]
    providers.extend(compatible_provider_statuses())

    saved_ai = saved_ai_runtime_config()
    saved_providers = saved_ai.get('providers') if isinstance(saved_ai.get('providers'), dict) else {}
    existing_provider_ids = {provider.get('provider') for provider in providers}
    reserved_provider_ids = {'openai', 'anthropic', 'deepseek', 'nvidia', 'fallback', 'unified', 'minimax'}
    for provider_id, saved_provider in (saved_providers.items() if isinstance(saved_providers, dict) else []):
        provider_key = normalize_provider_id(provider_id)
        if not provider_key or provider_key in existing_provider_ids or provider_key in reserved_provider_ids:
            continue
        if not isinstance(saved_provider, dict) or not saved_provider.get('openAICompatible', True):
            continue
        saved_models = _sanitize_model_catalog(saved_ai.get('modelCatalog')).get(provider_key, [])
        providers.append({
            'provider': provider_key,
            'label': str(saved_provider.get('label') or provider_key.replace('_', ' ').title()),
            'configured': bool(saved_provider.get('apiKey') and saved_provider.get('baseUrl')),
            'defaultModel': saved_provider.get('defaultModel') or 'auto',
            'modelCount': len(saved_models) or 1,
            'apiKeyConfigured': bool(saved_provider.get('apiKey')),
            'baseUrlConfigured': bool(saved_provider.get('baseUrl')),
            'baseUrl': saved_provider.get('baseUrl') or '',
            'openAICompatible': True,
            'managedInAdmin': True,
            'configurationHint': 'OpenAI-compatible provider managed from Admin settings.',
        })

    for provider in providers:
        saved_provider = saved_providers.get(provider['provider']) if isinstance(saved_providers, dict) else None
        if not isinstance(saved_provider, dict):
            continue
        saved_key = saved_provider.get('apiKey') or saved_provider.get('api_key') or ''
        saved_base_url = saved_provider.get('baseUrl') or saved_provider.get('base_url') or ''
        saved_model = saved_provider.get('defaultModel') or saved_provider.get('default_model') or ''
        if saved_key:
            provider['apiKeyConfigured'] = True
        if saved_base_url:
            provider['baseUrlConfigured'] = True
            provider['baseUrl'] = saved_base_url
        if saved_model:
            provider['defaultModel'] = saved_model
        provider['managedInAdmin'] = True
        provider['configured'] = bool(
            provider.get('apiKeyConfigured') and (
                not provider.get('openAICompatible') or provider.get('baseUrlConfigured') or provider.get('baseUrl')
            )
        )

    default_provider = saved_ai.get('defaultProvider') or saved_ai.get('default_provider') or os.getenv('AI_DEFAULT_PROVIDER')
    if not default_provider:
        configured_provider = next((p for p in providers if p.get('configured')), None)
        default_provider = configured_provider.get('provider') if configured_provider else 'openai'
    default_model = saved_ai.get('defaultModel') or saved_ai.get('default_model') or os.getenv('AI_DEFAULT_MODEL')
    if not default_model:
        provider_match = next((p for p in providers if p.get('provider') == default_provider), None)
        default_model = provider_match.get('defaultModel') if provider_match else (
            unified_default_model if default_provider == 'unified'
            else os.getenv('NVIDIA_DEFAULT_MODEL', 'meta/llama-3.1-8b-instruct')
        )

    robin_checkout_ready = bool(stripe_secret)

    return jsonify({
        'serverTime': datetime.now(timezone.utc).isoformat(),
        'environment': os.getenv('FLASK_ENV', 'production'),
        'frontendUrl': os.getenv('FRONTEND_URL', ''),
        'ai': {
            'defaultProvider': default_provider,
            'defaultModel': default_model,
            'providers': providers,
            'settings': _public_ai_runtime_config(saved_ai),
        },
        'stripe': {
            'mode': stripe_mode,
            'secretKeyConfigured': bool(stripe_secret),
            'publishableKeyConfigured': bool(stripe_publishable),
            'webhookConfigured': bool(stripe_webhook),
            'robinCreditCheckoutReady': robin_checkout_ready,
            'checkoutReady': robin_checkout_ready,
            'webhookReady': bool(stripe_secret and stripe_webhook),
            'retiredPaidPlanCheckout': True,
        },
        'database': {
            'urlConfigured': bool(os.getenv('DATABASE_URL')),
        },
        'email': {
            'provider': email_provider,
            'configured': bool(resend_api_key or plunk_api_key),
            'resendConfigured': bool(resend_api_key),
            'plunkConfigured': bool(plunk_api_key),
            'fromConfigured': bool(email_from),
            'fromAddress': email_from,
            'apiUrl': (
                os.getenv('RESEND_API_URL', 'https://api.resend.com/emails')
                if email_provider == 'resend'
                else os.getenv('PLUNK_API_URL', 'https://next-api.useplunk.com/v1/send')
            ),
        },
    })


@api_bp.route('/admin/ai-settings', methods=['GET', 'POST'])
@require_admin
def admin_ai_settings_endpoint():
    user = request.current_user
    if request.method == 'GET':
        return jsonify({'success': True, 'settings': _public_ai_runtime_config()})

    data = request.get_json() or {}
    providers = data.get('providers') if isinstance(data.get('providers'), dict) else {}
    sanitized_providers = {}
    existing = saved_ai_runtime_config()
    existing_providers = existing.get('providers') if isinstance(existing.get('providers'), dict) else {}

    for provider_id, provider_config in providers.items():
        if not isinstance(provider_config, dict):
            continue
        provider_key = str(provider_id or '').strip().lower()
        if not provider_key:
            continue
        previous = existing_providers.get(provider_key) if isinstance(existing_providers, dict) else {}
        previous = previous if isinstance(previous, dict) else {}
        api_key = provider_config.get('apiKey')
        if not api_key and (provider_config.get('keepExistingApiKey') or provider_config.get('apiKeyConfigured')):
            api_key = previous.get('apiKey') or previous.get('api_key')
        openai_compatible = provider_config.get('openAICompatible')
        if openai_compatible is None:
            openai_compatible = provider_config.get('open_ai_compatible')
        if openai_compatible is None:
            openai_compatible = previous.get('openAICompatible')
        if openai_compatible is None:
            openai_compatible = provider_key not in {'openai', 'anthropic', 'deepseek', 'nvidia'}
        sanitized = {
            'enabled': bool(provider_config.get('enabled', True)),
            'defaultModel': str(provider_config.get('defaultModel') or provider_config.get('default_model') or '').strip(),
            'label': str(provider_config.get('label') or previous.get('label') or provider_key.replace('_', ' ').title()).strip()[:120],
            'openAICompatible': bool(openai_compatible),
            'custom': bool(provider_config.get('custom') or previous.get('custom') or provider_key not in {'openai', 'anthropic', 'deepseek', 'nvidia', 'unified', 'minimax'}),
        }
        base_url = str(provider_config.get('baseUrl') or provider_config.get('base_url') or '').strip()
        if base_url:
            sanitized['baseUrl'] = base_url
        if api_key:
            sanitized['apiKey'] = str(api_key).strip()
        sanitized_providers[provider_key] = sanitized

    fallback = data.get('fallbackProviders') or data.get('fallback_providers') or []
    if isinstance(fallback, str):
        fallback = [item.strip() for item in fallback.split(',') if item.strip()]
    if not isinstance(fallback, list):
        fallback = []

    role_assignments = _public_role_assignments({
        'roleAssignments': data.get('roleAssignments') if isinstance(data.get('roleAssignments'), dict) else {},
    })

    saved = save_admin_setting('ai_runtime_config', {
        'defaultProvider': str(data.get('defaultProvider') or data.get('default_provider') or '').strip().lower(),
        'defaultModel': str(data.get('defaultModel') or data.get('default_model') or '').strip(),
        'fallbackProviders': [str(item).strip().lower() for item in fallback if str(item).strip()],
        'providers': sanitized_providers,
        'modelCatalog': _sanitize_model_catalog(data.get('modelCatalog')),
        'roleAssignments': role_assignments,
    }, user.get('id'))
    return jsonify({'success': True, 'settings': _public_ai_runtime_config(saved)})


def _saved_provider_secret(provider_id, key):
    config = saved_ai_runtime_config()
    providers = config.get('providers') if isinstance(config.get('providers'), dict) else {}
    provider_config = providers.get(provider_id) if isinstance(providers, dict) else {}
    if isinstance(provider_config, dict):
        value = provider_config.get(key) or provider_config.get(key.replace('K', '_k').lower())
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ''


def _provider_model_endpoint(provider_id, incoming):
    incoming = incoming if isinstance(incoming, dict) else {}
    compatible = _openai_compatible_provider(provider_id)
    base_url = str(incoming.get('baseUrl') or incoming.get('base_url') or '').strip()
    api_key = str(incoming.get('apiKey') or incoming.get('api_key') or '').strip()
    default_model = str(incoming.get('defaultModel') or incoming.get('default_model') or '').strip()

    if not base_url and compatible:
        base_url = compatible.get('base_url') or ''
    if not api_key and compatible:
        api_key = compatible.get('api_key') or ''
    if not default_model and compatible:
        default_model = compatible.get('default_model') or ''

    if not api_key:
        api_key = _saved_provider_secret(provider_id, 'apiKey')
    if not base_url:
        base_url = _saved_provider_secret(provider_id, 'baseUrl')
    if not default_model:
        default_model = _saved_provider_secret(provider_id, 'defaultModel') or _default_model_for_provider(provider_id)

    if provider_id == 'openai':
        return 'https://api.openai.com/v1', api_key or os.getenv('OPENAI_API_KEY', ''), default_model
    if provider_id == 'deepseek':
        return 'https://api.deepseek.com/v1', api_key or os.getenv('DEEPSEEK_API_KEY', ''), default_model
    if provider_id == 'nvidia':
        return 'https://integrate.api.nvidia.com/v1', api_key or os.getenv('NVIDIA_API_KEY', ''), default_model
    if provider_id == 'anthropic':
        return '', api_key or os.getenv('ANTHROPIC_API_KEY', ''), default_model
    if provider_id == 'minimax':
        return (
            base_url or os.getenv('MINIMAX_BASE_URL', 'https://api.minimax.io/v1'),
            api_key or os.getenv('MINIMAX_API_KEY', ''),
            default_model or os.getenv('MINIMAX_DEFAULT_MODEL', 'MiniMax-M3'),
        )
    return base_url, api_key, default_model


def _normalize_model_list(payload, default_model=''):
    raw_models = payload.get('data') if isinstance(payload, dict) else payload
    models = []
    if isinstance(raw_models, list):
        for item in raw_models:
            model_id = item.get('id') if isinstance(item, dict) else item
            model_id = str(model_id or '').strip()
            if model_id and model_id not in models:
                models.append(model_id[:220])
    if default_model and default_model not in models:
        models.insert(0, default_model)
    return models[:200]


MINIMAX_MODEL_CATALOG = [
    'MiniMax-M3',
    'MiniMax-M2.7',
    'MiniMax-M2.7-highspeed',
    'MiniMax-M2.5',
    'MiniMax-M2.5-highspeed',
    'MiniMax-M2.1',
]


@api_bp.route('/admin/ai-provider-models', methods=['POST'])
@require_admin
def admin_ai_provider_models_endpoint():
    data = request.get_json() or {}
    provider_id = _normalize_provider_id(data.get('provider') or data.get('providerId'))
    if not provider_id:
        return jsonify({'error': 'Provider is required.'}), 400

    incoming = data.get('providerConfig') if isinstance(data.get('providerConfig'), dict) else {}
    base_url, api_key, default_model = _provider_model_endpoint(provider_id, incoming)

    if provider_id == 'anthropic':
        models = _sanitize_string_list([
            default_model,
            'claude-3-5-haiku-latest',
            'claude-3-5-sonnet-latest',
            'claude-3-opus-latest',
        ])
        return jsonify({'success': True, 'provider': provider_id, 'models': models})

    if provider_id == 'minimax':
        models = _sanitize_string_list([default_model, *MINIMAX_MODEL_CATALOG])
        return jsonify({'success': True, 'provider': provider_id, 'models': models})

    if not base_url or not api_key:
        return jsonify({'error': 'Provider key and base URL are required before models can be refreshed.'}), 400

    try:
        response = http_requests.get(
            f'{base_url.rstrip("/")}/models',
            headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
            timeout=30,
        )
        response.raise_for_status()
        models = _normalize_model_list(response.json(), default_model)
    except Exception as exc:
        if default_model:
            models = [default_model]
        else:
            return jsonify({'error': f'Unable to load models: {str(exc)[:180]}'}), 502

    return jsonify({'success': True, 'provider': provider_id, 'models': models})


@api_bp.route('/admin/lawyer-directory', methods=['GET', 'POST'])
@require_admin
def admin_lawyer_directory_endpoint():
    user = request.current_user
    if request.method == 'GET':
        return jsonify({'success': True, 'settings': _public_lawyer_directory_config()})

    saved = save_admin_setting(
        'lawyer_directory_config',
        _public_lawyer_directory_config(request.get_json() or {}),
        user.get('id'),
    )
    return jsonify({'success': True, 'settings': _public_lawyer_directory_config(saved)})


@api_bp.route('/admin/welcome-messages', methods=['GET', 'POST'])
@require_admin
def admin_welcome_messages_endpoint():
    user = request.current_user
    defaults = {
        'signupEnabled': True,
        'upgradeEnabled': True,
        'sendEmail': True,
        'signupTitle': 'Welcome to Spouse Interview',
        'signupMessage': 'Your free account is ready. Start with your dashboard, build your timeline, and save questions for later review.',
        'upgradeTitle': 'Premium access unlocked',
        'upgradeMessage': 'Thank you for upgrading. Your premium downloads, partner sync, and Robin practice access are now available in your dashboard.',
    }
    current = {**defaults, **(saved_welcome_message_config() or {})}
    if request.method == 'GET':
        return jsonify({'success': True, 'settings': current})

    data = request.get_json() or {}
    saved = save_admin_setting('welcome_messages', {
        'signupEnabled': bool(data.get('signupEnabled', current['signupEnabled'])),
        'upgradeEnabled': bool(data.get('upgradeEnabled', current['upgradeEnabled'])),
        'sendEmail': bool(data.get('sendEmail', current['sendEmail'])),
        'signupTitle': str(data.get('signupTitle') or current['signupTitle'])[:200],
        'signupMessage': str(data.get('signupMessage') or current['signupMessage'])[:6000],
        'upgradeTitle': str(data.get('upgradeTitle') or current['upgradeTitle'])[:200],
        'upgradeMessage': str(data.get('upgradeMessage') or current['upgradeMessage'])[:6000],
    }, user.get('id'))
    return jsonify({'success': True, 'settings': {**defaults, **(saved or {})}})


@api_bp.route('/admin/ad-settings', methods=['GET', 'POST'])
@require_admin
def admin_ad_settings_endpoint():
    user = request.current_user
    if request.method == 'GET':
        return jsonify({'success': True, 'settings': saved_ad_settings_config()})

    data = request.get_json() or {}
    saved = save_admin_setting('ad_settings', normalize_ad_settings(data), user.get('id'))
    return jsonify({'success': True, 'settings': normalize_ad_settings(saved)})


@api_bp.route('/admin/robin-usage-settings', methods=['GET', 'POST'])
@require_admin
def admin_robin_usage_settings_endpoint():
    user = request.current_user
    if request.method == 'GET':
        return jsonify({'success': True, 'settings': saved_robin_usage_config()})

    data = request.get_json() or {}
    saved = save_admin_setting('robin_usage_settings', normalize_robin_usage_settings(data), user.get('id'))
    return jsonify({'success': True, 'settings': normalize_robin_usage_settings(saved)})


@api_bp.route('/admin/pdf-download-offer', methods=['GET', 'POST'])
@require_admin
def admin_pdf_download_offer_endpoint():
    user = request.current_user
    if request.method == 'GET':
        stats = []
        try:
            _ensure_pdf_offer_analytics_table()
            stats = db.query_all(
                """
                SELECT
                    offer_id,
                    source,
                    COUNT(*) FILTER (WHERE event_type = 'impression') AS impressions,
                    COUNT(*) FILTER (WHERE event_type = 'cta_click') AS cta_clicks,
                    COUNT(*) FILTER (WHERE event_type = 'body_link_click') AS body_link_clicks,
                    COUNT(*) FILTER (WHERE event_type = 'dismissed') AS dismissals,
                    COUNT(*) FILTER (WHERE event_type = 'continued') AS continues,
                    MAX(created_at) AS last_event_at
                FROM pdf_download_offer_events
                GROUP BY offer_id, source
                ORDER BY last_event_at DESC NULLS LAST
                LIMIT 30
                """
            )
        except Exception:
            stats = []
        return jsonify({'success': True, 'settings': saved_pdf_download_offer_config(), 'stats': stats})

    data = request.get_json() or {}
    saved = save_admin_setting(
        'pdf_download_offer',
        normalize_pdf_download_offer_settings(data),
        user.get('id'),
    )
    return jsonify({'success': True, 'settings': normalize_pdf_download_offer_settings(saved)})


@api_bp.route('/ad-settings/public', methods=['GET'])
def public_ad_settings_endpoint():
    settings = saved_ad_settings_config()
    return jsonify({
        'success': True,
        'settings': {
            'status': settings.get('status', 'disabled'),
            'adsensePublisherId': settings.get('adsensePublisherId', ''),
            'adsenseSlotId': settings.get('adsenseSlotId', ''),
            'placements': settings.get('placements', {}),
        },
    })


@api_bp.route('/pdf-download-offer/public', methods=['GET'])
def public_pdf_download_offer_endpoint():
    settings = saved_pdf_download_offer_config()
    source = str(request.args.get('source') or 'topic_page').strip()
    is_enabled_for_source = bool((settings.get('sources') or {}).get(source))
    has_content = bool(str(settings.get('bodyHtml') or '').strip() or str(settings.get('ctaUrl') or '').strip())
    if not settings.get('enabled') or not is_enabled_for_source or not has_content:
        return jsonify({'success': True, 'offer': {'enabled': False}})

    return jsonify({
        'success': True,
        'offer': {
            'enabled': True,
            'offerId': _pdf_offer_fingerprint(settings, source),
            'disclosureLabel': settings.get('disclosureLabel') or 'Sponsored Resource',
            'title': settings.get('title') or 'Before you download',
            'bodyHtml': settings.get('bodyHtml') or '',
            'ctaLabel': settings.get('ctaLabel') or 'Open sponsored resource',
            'ctaUrl': settings.get('ctaUrl') or '',
            'continueLabel': settings.get('continueLabel') or 'Continue to PDF',
            'frequency': settings.get('frequency') or 'once_per_session',
        },
    })


@api_bp.route('/pdf-download-offer/event', methods=['POST'])
@optional_auth
def track_pdf_download_offer_event():
    user = request.current_user
    data = request.get_json() or {}
    event_type = str(data.get('eventType') or '').strip()
    if event_type not in {'impression', 'cta_click', 'body_link_click', 'dismissed', 'continued'}:
        return jsonify({'error': 'Invalid offer event type'}), 400

    settings = saved_pdf_download_offer_config()
    source = str(data.get('source') or 'topic_page').strip()[:80]
    offer_id = str(data.get('offerId') or _pdf_offer_fingerprint(settings, source)).strip()[:80]
    target_url = str(data.get('targetUrl') or '').strip()[:700] or None

    try:
        _ensure_pdf_offer_analytics_table()
        db.execute(
            """
            INSERT INTO pdf_download_offer_events (
                offer_id, source, event_type, user_id, target_url, metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s::jsonb)
            """,
            (
                offer_id,
                source,
                event_type,
                user.get('id') if user else None,
                target_url,
                json_dumps(_request_client_metadata({'ctaUrl': settings.get('ctaUrl') or ''})),
            ),
        )
    except Exception as e:
        print(f"PDF offer analytics storage unavailable: {e}")
        return jsonify({'success': True, 'stored': False}), 202

    return jsonify({'success': True, 'stored': True})


VERIFICATION_PLACEMENTS = {'head', 'footer', 'body_end'}
VERIFICATION_ENVIRONMENTS = {'production', 'test'}


def _enabled_verification_code(placement, environment='production'):
    placement = str(placement or '').strip()
    environment = str(environment or 'production').strip()
    if placement not in VERIFICATION_PLACEMENTS:
        return ''
    if environment not in VERIFICATION_ENVIRONMENTS:
        environment = 'production'

    try:
        row = db.query_one(
            """
            SELECT code
            FROM site_verification_codes
            WHERE placement = %s
              AND environment = %s
              AND is_enabled = true
              AND COALESCE(code, '') <> ''
            LIMIT 1
            """,
            (placement, environment),
        )
    except Exception:
        return ''
    return str((row or {}).get('code') or '')


@api_bp.route('/verification-code/<placement>', methods=['GET'])
def public_verification_code_endpoint(placement):
    return jsonify({
        'success': True,
        'code': _enabled_verification_code(
            placement,
            request.args.get('environment') or 'production',
        ),
    })


@api_bp.route('/sponsor-links/<slug>/go', methods=['GET'])
@optional_auth
def sponsor_link_redirect(slug):
    link = db.query_one(
        """
        SELECT id, slug, destination_url, is_active
        FROM sponsor_links
        WHERE slug = %s
        """,
        (_slugify_sponsor_link(slug),),
    )
    if not link or not link.get('is_active'):
        return jsonify({'error': 'Sponsor link not found'}), 404

    user = request.current_user
    try:
        db.execute(
            """
            INSERT INTO sponsor_link_clicks (
              sponsor_link_id, user_id, referrer, user_agent_hash, metadata
            )
            VALUES (%s, %s, %s, %s, %s::jsonb)
            """,
            (
                link.get('id'),
                user.get('id') if user else None,
                str(request.headers.get('Referer') or '')[:1000],
                _hash_header_value(request.headers.get('User-Agent')),
                json_dumps({
                    'source': request.args.get('source') or 'tracked_link',
                    'slug': link.get('slug'),
                }),
            ),
        )
    except Exception:
        pass

    return redirect(link.get('destination_url'), code=302)


@api_bp.route('/admin/sponsor-links', methods=['GET', 'POST'])
@require_admin
def admin_sponsor_links():
    user = request.current_user
    if request.method == 'GET':
        rows = db.query_all(
            """
            SELECT
                sl.id, sl.slug, sl.title, sl.sponsor_name, sl.destination_url,
                sl.disclosure_label, sl.notes, sl.is_active, sl.created_by,
                sl.created_at, sl.updated_at,
                COUNT(slc.id) AS click_count,
                COUNT(DISTINCT slc.user_id) FILTER (WHERE slc.user_id IS NOT NULL) AS unique_users,
                MAX(slc.created_at) AS last_click_at
            FROM sponsor_links sl
            LEFT JOIN sponsor_link_clicks slc ON slc.sponsor_link_id = sl.id
            GROUP BY sl.id
            ORDER BY sl.created_at DESC
            LIMIT 250
            """
        )
        return jsonify({'success': True, 'links': [_serialize_sponsor_link(row) for row in rows]})

    data = request.get_json() or {}
    title = str(data.get('title') or '').strip()[:180]
    sponsor_name = str(data.get('sponsorName') or data.get('sponsor_name') or '').strip()[:180]
    destination_url = str(data.get('destinationUrl') or data.get('destination_url') or '').strip()
    disclosure_label = str(data.get('disclosureLabel') or data.get('disclosure_label') or 'Sponsored Resource').strip()[:120]
    notes = str(data.get('notes') or '').strip()[:1000]
    requested_slug = _slugify_sponsor_link(data.get('slug') or title or sponsor_name)

    if not title or not destination_url:
        return jsonify({'error': 'Title and destination URL are required'}), 400
    if not _valid_external_url(destination_url):
        return jsonify({'error': 'Destination URL must start with http:// or https://'}), 400

    slug = requested_slug
    for index in range(2, 25):
        existing = db.query_one("SELECT id FROM sponsor_links WHERE slug = %s", (slug,))
        if not existing:
            break
        slug = f"{requested_slug}-{index}"

    try:
        row = db.execute_returning(
            """
            INSERT INTO sponsor_links (
              slug, title, sponsor_name, destination_url, disclosure_label,
              notes, is_active, created_by
            )
            VALUES (%s, %s, %s, %s, %s, %s, true, %s)
            RETURNING id, slug, title, sponsor_name, destination_url,
                      disclosure_label, notes, is_active, created_by,
                      created_at, updated_at,
                      0 AS click_count, 0 AS unique_users, NULL::timestamptz AS last_click_at
            """,
            (slug, title, sponsor_name, destination_url, disclosure_label, notes, user.get('id')),
        )
        return jsonify({'success': True, 'link': _serialize_sponsor_link(row)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/admin/sponsor-links/<link_id>', methods=['PATCH'])
@require_admin
def update_admin_sponsor_link(link_id):
    link_uuid = _coerce_uuid_text(link_id)
    if not link_uuid:
        return jsonify({'error': 'Invalid sponsor link id'}), 400

    data = request.get_json() or {}
    updates = []
    params = []

    if 'title' in data:
        title = str(data.get('title') or '').strip()[:180]
        if not title:
            return jsonify({'error': 'Title is required'}), 400
        updates.append('title = %s')
        params.append(title)
    if 'sponsorName' in data or 'sponsor_name' in data:
        updates.append('sponsor_name = %s')
        params.append(str(data.get('sponsorName') or data.get('sponsor_name') or '').strip()[:180])
    if 'destinationUrl' in data or 'destination_url' in data:
        destination_url = str(data.get('destinationUrl') or data.get('destination_url') or '').strip()
        if not _valid_external_url(destination_url):
            return jsonify({'error': 'Destination URL must start with http:// or https://'}), 400
        updates.append('destination_url = %s')
        params.append(destination_url)
    if 'disclosureLabel' in data or 'disclosure_label' in data:
        updates.append('disclosure_label = %s')
        params.append(str(data.get('disclosureLabel') or data.get('disclosure_label') or 'Sponsored Resource').strip()[:120])
    if 'notes' in data:
        updates.append('notes = %s')
        params.append(str(data.get('notes') or '').strip()[:1000])
    if 'isActive' in data or 'is_active' in data:
        updates.append('is_active = %s')
        params.append(bool(data.get('isActive', data.get('is_active'))))

    if not updates:
        return jsonify({'error': 'No changes provided'}), 400

    params.append(link_uuid)
    try:
        row = db.execute_returning(
            f"""
            WITH updated AS (
                UPDATE sponsor_links
                SET {', '.join(updates)}, updated_at = now()
                WHERE id = %s
                RETURNING *
            )
            SELECT
                u.id, u.slug, u.title, u.sponsor_name, u.destination_url,
                u.disclosure_label, u.notes, u.is_active, u.created_by,
                u.created_at, u.updated_at,
                COUNT(slc.id) AS click_count,
                COUNT(DISTINCT slc.user_id) FILTER (WHERE slc.user_id IS NOT NULL) AS unique_users,
                MAX(slc.created_at) AS last_click_at
            FROM updated u
            LEFT JOIN sponsor_link_clicks slc ON slc.sponsor_link_id = u.id
            GROUP BY u.id, u.slug, u.title, u.sponsor_name, u.destination_url,
                     u.disclosure_label, u.notes, u.is_active, u.created_by,
                     u.created_at, u.updated_at
            """,
            tuple(params),
        )
        if not row:
            return jsonify({'error': 'Sponsor link not found'}), 404
        return jsonify({'success': True, 'link': _serialize_sponsor_link(row)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/admin/users', methods=['GET', 'POST'])
@require_admin
def admin_users():
    limit = request.args.get('limit', 100, type=int) or 100
    limit = max(1, min(limit, 250))

    users_sql = """
        WITH ticket_stats AS (
            SELECT
                user_id,
                COUNT(*) AS total_tickets,
                COUNT(*) FILTER (WHERE status = 'open') AS open_tickets,
                MAX(created_at)::text AS last_ticket_at
            FROM support_tickets
            GROUP BY user_id
        ),
        partner_stats AS (
            SELECT
                owner_user_id AS user_id,
                COUNT(*) FILTER (WHERE status = 'connected') AS connected_partners,
                COUNT(*) FILTER (WHERE status = 'pending') AS pending_partners
            FROM (
                SELECT user_id AS owner_user_id, status FROM partner_connections
                UNION ALL
                SELECT partner_id AS owner_user_id, status FROM partner_connections
            ) all_partner_connections
            GROUP BY owner_user_id
        ),
        ai_usage_stats AS (
            SELECT
                user_id,
                COALESCE(SUM(sessions_count), 0) AS ai_sessions_total,
                COALESCE(SUM(total_turns), 0) AS ai_turns_total,
                COALESCE(SUM(sessions_count) FILTER (WHERE usage_date = CURRENT_DATE), 0) AS ai_sessions_today,
                COALESCE(SUM(total_turns) FILTER (WHERE usage_date = CURRENT_DATE), 0) AS ai_turns_today,
                MAX(updated_at) AS last_ai_at
            FROM ai_daily_usage
            GROUP BY user_id
        ),
        notification_stats AS (
            SELECT
                user_id,
                COUNT(*) AS messages_received,
                COUNT(*) FILTER (WHERE is_read = false) AS unread_messages,
                MAX(created_at) AS last_message_at
            FROM user_notifications
            GROUP BY user_id
        ),
        notification_event_stats AS (
            SELECT
                user_id,
                COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'opened') AS messages_opened,
                COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'clicked') AS messages_clicked,
                MAX(created_at) AS last_message_event_at
            FROM notification_events
            GROUP BY user_id
        ),
        question_stats AS (
            SELECT
                user_id,
                COUNT(*) FILTER (WHERE is_saved_for_later = true) AS saved_questions,
                COUNT(DISTINCT topic_id) AS topics_touched,
                MAX(COALESCE(last_reviewed_at, updated_at, created_at)) AS last_practice_at
            FROM question_states
            GROUP BY user_id
        ),
        topic_stats AS (
            SELECT
                user_id,
                COUNT(*) AS topics_started,
                COUNT(*) FILTER (WHERE is_completed = true) AS topics_completed,
                MAX(updated_at) AS last_topic_at
            FROM user_topic_progress
            GROUP BY user_id
        )
        SELECT
            u.id::text AS id,
            u.email,
            u.created_at::text AS joined_at,
            u.updated_at::text AS updated_at,
            COALESCE(
                NULLIF(p.display_name, ''),
                NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                u.email
            ) AS display_name,
            COALESCE(p.role, 'user') AS role,
            COALESCE(p.is_active, true) AS is_active,
            COALESCE(s.plan_type, 'trial') AS plan_type,
            COALESCE(s.status, 'trialing') AS subscription_status,
            s.provider,
            s.provider_customer_id,
            s.provider_subscription_id,
            s.trial_ends_at::text AS trial_ends_at,
            s.current_period_ends_at::text AS current_period_ends_at,
            s.ends_at::text AS ends_at,
            COALESCE(ds.total_downloads, 0) AS total_downloads,
            COALESCE(ds.unique_pdfs_downloaded, 0) AS unique_pdfs_downloaded,
            ds.last_download_at::text AS last_download_at,
            COALESCE(ts.total_tickets, 0) AS total_tickets,
            COALESCE(ts.open_tickets, 0) AS open_tickets,
            ts.last_ticket_at,
            COALESCE(ps.connected_partners, 0) AS connected_partners,
            COALESCE(ps.pending_partners, 0) AS pending_partners,
            COALESCE(ai.ai_sessions_total, 0) AS ai_sessions_total,
            COALESCE(ai.ai_turns_total, 0) AS ai_turns_total,
            COALESCE(ai.ai_sessions_today, 0) AS ai_sessions_today,
            COALESCE(ai.ai_turns_today, 0) AS ai_turns_today,
            ai.last_ai_at::text AS last_ai_at,
            COALESCE(ns.messages_received, 0) AS messages_received,
            COALESCE(ns.unread_messages, 0) AS unread_messages,
            ns.last_message_at::text AS last_message_at,
            COALESCE(nes.messages_opened, 0) AS messages_opened,
            COALESCE(nes.messages_clicked, 0) AS messages_clicked,
            nes.last_message_event_at::text AS last_message_event_at,
            COALESCE(qs.saved_questions, 0) AS saved_questions,
            COALESCE(qs.topics_touched, 0) AS topics_touched,
            COALESCE(tops.topics_started, 0) AS topics_started,
            COALESCE(tops.topics_completed, 0) AS topics_completed,
            GREATEST(
                u.updated_at,
                COALESCE(ds.last_download_at, u.updated_at),
                COALESCE(ai.last_ai_at, u.updated_at),
                COALESCE(ns.last_message_at, u.updated_at),
                COALESCE(nes.last_message_event_at, u.updated_at),
                COALESCE(qs.last_practice_at, u.updated_at),
                COALESCE(tops.last_topic_at, u.updated_at),
                COALESCE(ts.last_ticket_at::timestamptz, u.updated_at)
            )::text AS last_activity_at
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        LEFT JOIN user_subscriptions s ON s.user_id = u.id
        LEFT JOIN pdf_download_summaries ds ON ds.user_id = u.id
        LEFT JOIN ticket_stats ts ON ts.user_id = u.id
        LEFT JOIN partner_stats ps ON ps.user_id = u.id
        LEFT JOIN ai_usage_stats ai ON ai.user_id = u.id
        LEFT JOIN notification_stats ns ON ns.user_id = u.id
        LEFT JOIN notification_event_stats nes ON nes.user_id = u.id
        LEFT JOIN question_stats qs ON qs.user_id = u.id
        LEFT JOIN topic_stats tops ON tops.user_id = u.id
        ORDER BY u.created_at DESC
        LIMIT %s
    """

    totals_sql = """
        WITH ticket_stats AS (
            SELECT user_id, COUNT(*) FILTER (WHERE status = 'open') AS open_tickets
            FROM support_tickets
            GROUP BY user_id
        )
        SELECT
            COUNT(*) AS total_users,
            COUNT(*) FILTER (
                WHERE COALESCE(s.plan_type, 'trial') <> 'trial'
                AND COALESCE(s.status, 'trialing') IN ('active', 'canceled', 'grace_period')
            ) AS paid_users,
            COUNT(*) FILTER (WHERE COALESCE(s.status, 'trialing') = 'trialing') AS trial_users,
            COUNT(*) FILTER (WHERE COALESCE(ts.open_tickets, 0) > 0) AS users_with_open_tickets,
            COUNT(*) FILTER (WHERE COALESCE(ai.total_turns_today, 0) > 0) AS robin_active_today,
            COUNT(*) FILTER (WHERE COALESCE(ns.unread_messages, 0) > 0) AS users_with_unread_messages
        FROM users u
        LEFT JOIN user_subscriptions s ON s.user_id = u.id
        LEFT JOIN ticket_stats ts ON ts.user_id = u.id
        LEFT JOIN (
            SELECT user_id, SUM(total_turns) AS total_turns_today
            FROM ai_daily_usage
            WHERE usage_date = CURRENT_DATE
            GROUP BY user_id
        ) ai ON ai.user_id = u.id
        LEFT JOIN (
            SELECT user_id, COUNT(*) AS unread_messages
            FROM user_notifications
            WHERE is_read = false
            GROUP BY user_id
        ) ns ON ns.user_id = u.id
    """

    try:
        rows = db.query_all(users_sql, (limit,))
        totals = db.query_one(totals_sql) or {}
        return jsonify({
            'users': rows,
            'totals': {
                'totalUsers': totals.get('total_users', 0),
                'paidUsers': totals.get('paid_users', 0),
                'trialUsers': totals.get('trial_users', 0),
                'freeUsers': totals.get('total_users', 0),
                'usersWithOpenTickets': totals.get('users_with_open_tickets', 0),
                'robinActiveToday': totals.get('robin_active_today', 0),
                'usersWithUnreadMessages': totals.get('users_with_unread_messages', 0),
            },
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/admin/reports/user-activity.csv', methods=['GET'])
@require_admin
def admin_user_activity_report_csv():
    limit = request.args.get('limit', 1000, type=int) or 1000
    limit = max(1, min(limit, 5000))
    rows = db.query_all(
        """
        WITH ticket_stats AS (
            SELECT
                user_id,
                COUNT(*) AS total_tickets,
                COUNT(*) FILTER (WHERE status = 'open') AS open_tickets,
                MAX(created_at) AS last_ticket_at
            FROM support_tickets
            GROUP BY user_id
        ),
        partner_stats AS (
            SELECT
                owner_user_id AS user_id,
                COUNT(*) FILTER (WHERE status = 'connected') AS connected_partners,
                COUNT(*) FILTER (WHERE status = 'pending') AS pending_partners
            FROM (
                SELECT user_id AS owner_user_id, status FROM partner_connections
                UNION ALL
                SELECT partner_id AS owner_user_id, status FROM partner_connections
            ) all_partner_connections
            GROUP BY owner_user_id
        ),
        ai_usage_stats AS (
            SELECT
                user_id,
                COALESCE(SUM(sessions_count), 0) AS ai_sessions_total,
                COALESCE(SUM(total_turns), 0) AS ai_turns_total,
                COALESCE(SUM(sessions_count) FILTER (WHERE usage_date = CURRENT_DATE), 0) AS ai_sessions_today,
                COALESCE(SUM(total_turns) FILTER (WHERE usage_date = CURRENT_DATE), 0) AS ai_turns_today,
                MAX(updated_at) AS last_ai_at
            FROM ai_daily_usage
            GROUP BY user_id
        ),
        notification_stats AS (
            SELECT
                user_id,
                COUNT(*) AS messages_received,
                COUNT(*) FILTER (WHERE is_read = false) AS unread_messages,
                MAX(created_at) AS last_message_at
            FROM user_notifications
            GROUP BY user_id
        ),
        notification_event_stats AS (
            SELECT
                user_id,
                COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'opened') AS messages_opened,
                COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'clicked') AS messages_clicked,
                MAX(created_at) AS last_message_event_at
            FROM notification_events
            GROUP BY user_id
        ),
        question_stats AS (
            SELECT
                user_id,
                COUNT(*) FILTER (WHERE is_saved_for_later = true) AS saved_questions,
                COUNT(DISTINCT topic_id) AS topics_touched,
                MAX(COALESCE(last_reviewed_at, updated_at, created_at)) AS last_practice_at
            FROM question_states
            GROUP BY user_id
        ),
        topic_stats AS (
            SELECT
                user_id,
                COUNT(*) AS topics_started,
                COUNT(*) FILTER (WHERE is_completed = true) AS topics_completed,
                MAX(updated_at) AS last_topic_at
            FROM user_topic_progress
            GROUP BY user_id
        )
        SELECT
            u.id::text AS user_id,
            u.email,
            COALESCE(
                NULLIF(p.display_name, ''),
                NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                u.email
            ) AS display_name,
            COALESCE(p.role, 'user') AS role,
            COALESCE(p.is_active, true) AS is_active,
            u.created_at::text AS joined_at,
            COALESCE(s.plan_type, 'trial') AS plan_type,
            COALESCE(s.status, 'trialing') AS subscription_status,
            COALESCE(ai.ai_sessions_today, 0) AS ai_sessions_today,
            COALESCE(ai.ai_turns_today, 0) AS ai_turns_today,
            COALESCE(ai.ai_sessions_total, 0) AS ai_sessions_total,
            COALESCE(ai.ai_turns_total, 0) AS ai_turns_total,
            ai.last_ai_at::text AS last_ai_at,
            COALESCE(ds.total_downloads, 0) AS total_pdf_downloads,
            COALESCE(ds.unique_pdfs_downloaded, 0) AS unique_pdfs_downloaded,
            ds.last_download_at::text AS last_download_at,
            COALESCE(ns.messages_received, 0) AS messages_received,
            COALESCE(ns.unread_messages, 0) AS unread_messages,
            COALESCE(nes.messages_opened, 0) AS messages_opened,
            COALESCE(nes.messages_clicked, 0) AS messages_clicked,
            CASE
                WHEN COALESCE(ns.messages_received, 0) > 0
                THEN ROUND((COALESCE(nes.messages_opened, 0)::numeric / ns.messages_received) * 100, 1)
                ELSE 0
            END AS message_open_rate,
            CASE
                WHEN COALESCE(ns.messages_received, 0) > 0
                THEN ROUND((COALESCE(nes.messages_clicked, 0)::numeric / ns.messages_received) * 100, 1)
                ELSE 0
            END AS message_click_rate,
            COALESCE(qs.saved_questions, 0) AS saved_questions,
            COALESCE(qs.topics_touched, 0) AS topics_touched,
            COALESCE(tops.topics_started, 0) AS topics_started,
            COALESCE(tops.topics_completed, 0) AS topics_completed,
            COALESCE(ps.connected_partners, 0) AS connected_partners,
            COALESCE(ps.pending_partners, 0) AS pending_partners,
            COALESCE(ts.total_tickets, 0) AS total_tickets,
            COALESCE(ts.open_tickets, 0) AS open_tickets,
            ts.last_ticket_at::text AS last_ticket_at,
            GREATEST(
                u.updated_at,
                COALESCE(ds.last_download_at, u.updated_at),
                COALESCE(ai.last_ai_at, u.updated_at),
                COALESCE(ns.last_message_at, u.updated_at),
                COALESCE(nes.last_message_event_at, u.updated_at),
                COALESCE(qs.last_practice_at, u.updated_at),
                COALESCE(tops.last_topic_at, u.updated_at),
                COALESCE(ts.last_ticket_at, u.updated_at)
            )::text AS last_activity_at
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        LEFT JOIN user_subscriptions s ON s.user_id = u.id
        LEFT JOIN pdf_download_summaries ds ON ds.user_id = u.id
        LEFT JOIN ticket_stats ts ON ts.user_id = u.id
        LEFT JOIN partner_stats ps ON ps.user_id = u.id
        LEFT JOIN ai_usage_stats ai ON ai.user_id = u.id
        LEFT JOIN notification_stats ns ON ns.user_id = u.id
        LEFT JOIN notification_event_stats nes ON nes.user_id = u.id
        LEFT JOIN question_stats qs ON qs.user_id = u.id
        LEFT JOIN topic_stats tops ON tops.user_id = u.id
        ORDER BY last_activity_at DESC
        LIMIT %s
        """,
        (limit,),
    )
    headers = [
        'user_id', 'email', 'display_name', 'role', 'is_active', 'joined_at',
        'plan_type', 'subscription_status', 'ai_sessions_today', 'ai_turns_today',
        'ai_sessions_total', 'ai_turns_total', 'last_ai_at', 'total_pdf_downloads',
        'unique_pdfs_downloaded', 'last_download_at', 'messages_received',
        'unread_messages', 'messages_opened', 'messages_clicked',
        'message_open_rate', 'message_click_rate', 'saved_questions',
        'topics_touched', 'topics_started', 'topics_completed',
        'connected_partners', 'pending_partners', 'total_tickets',
        'open_tickets', 'last_ticket_at', 'last_activity_at',
    ]
    return _csv_response(
        'spouse-interview-user-activity.csv',
        headers,
        ([row.get(header) for header in headers] for row in rows),
    )


@api_bp.route('/admin/reports/broadcasts.csv', methods=['GET'])
@require_admin
def admin_broadcast_report_csv():
    limit = request.args.get('limit', 500, type=int) or 500
    limit = max(1, min(limit, 2500))
    rows = db.query_all(
        """
        WITH event_stats AS (
            SELECT
                broadcast_id,
                COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'delivered') AS delivered,
                COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'opened') AS opened,
                COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'clicked') AS clicked,
                COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'dismissed') AS dismissed,
                COUNT(*) FILTER (WHERE event_type = 'clicked') AS click_events
            FROM notification_events
            WHERE broadcast_id IS NOT NULL
            GROUP BY broadcast_id
        )
        SELECT
            b.id::text AS broadcast_id,
            b.title,
            b.message AS message_html,
            b.audience_type,
            b.is_active,
            b.sent_count,
            GREATEST(COALESCE(b.sent_count, 0), COALESCE(es.delivered, 0)) AS delivered,
            COALESCE(es.opened, 0) AS opened,
            COALESCE(es.clicked, 0) AS clicked,
            COALESCE(es.dismissed, 0) AS dismissed,
            COALESCE(es.click_events, 0) AS click_events,
            CASE
                WHEN GREATEST(COALESCE(b.sent_count, 0), COALESCE(es.delivered, 0)) > 0
                THEN ROUND((COALESCE(es.opened, 0)::numeric / GREATEST(COALESCE(b.sent_count, 0), COALESCE(es.delivered, 0))) * 100, 1)
                ELSE 0
            END AS open_rate,
            CASE
                WHEN GREATEST(COALESCE(b.sent_count, 0), COALESCE(es.delivered, 0)) > 0
                THEN ROUND((COALESCE(es.clicked, 0)::numeric / GREATEST(COALESCE(b.sent_count, 0), COALESCE(es.delivered, 0))) * 100, 1)
                ELSE 0
            END AS click_rate,
            b.send_email,
            b.scheduled_at::text AS scheduled_at,
            b.created_at::text AS created_at,
            b.updated_at::text AS updated_at
        FROM broadcast_messages b
        LEFT JOIN event_stats es ON es.broadcast_id = b.id
        ORDER BY b.created_at DESC
        LIMIT %s
        """,
        (limit,),
    )
    headers = [
        'broadcast_id', 'title', 'message_html', 'audience_type', 'is_active',
        'sent_count', 'delivered', 'opened', 'clicked', 'dismissed',
        'click_events', 'open_rate', 'click_rate', 'send_email',
        'scheduled_at', 'created_at', 'updated_at',
    ]
    return _csv_response(
        'spouse-interview-broadcast-performance.csv',
        headers,
        ([row.get(header) for header in headers] for row in rows),
    )


@api_bp.route('/admin/reports/sponsor-links.csv', methods=['GET'])
@require_admin
def admin_sponsor_link_report_csv():
    rows = db.query_all(
        """
        SELECT
            sl.id::text AS sponsor_link_id,
            sl.slug,
            sl.title,
            sl.sponsor_name,
            sl.destination_url,
            sl.disclosure_label,
            sl.notes,
            sl.is_active,
            COUNT(slc.id) AS total_clicks,
            COUNT(slc.id) FILTER (WHERE slc.created_at >= now() - INTERVAL '7 days') AS clicks_7d,
            COUNT(slc.id) FILTER (WHERE slc.created_at >= now() - INTERVAL '30 days') AS clicks_30d,
            COUNT(DISTINCT slc.user_id) FILTER (WHERE slc.user_id IS NOT NULL) AS unique_signed_in_users,
            COUNT(DISTINCT slc.user_agent_hash) FILTER (WHERE slc.user_agent_hash IS NOT NULL) AS unique_user_agents,
            COUNT(DISTINCT slc.referrer) FILTER (WHERE COALESCE(slc.referrer, '') <> '') AS unique_referrers,
            MIN(slc.created_at)::text AS first_click_at,
            MAX(slc.created_at)::text AS last_click_at,
            sl.created_at::text AS created_at,
            sl.updated_at::text AS updated_at
        FROM sponsor_links sl
        LEFT JOIN sponsor_link_clicks slc ON slc.sponsor_link_id = sl.id
        GROUP BY sl.id
        ORDER BY sl.created_at DESC
        """
    )
    headers = [
        'sponsor_link_id', 'slug', 'title', 'sponsor_name', 'tracking_url',
        'destination_url', 'disclosure_label', 'notes', 'is_active',
        'total_clicks', 'clicks_7d', 'clicks_30d', 'unique_signed_in_users',
        'unique_user_agents', 'unique_referrers', 'first_click_at',
        'last_click_at', 'created_at', 'updated_at',
    ]

    def report_rows():
        for row in rows:
            yield [
                row.get('sponsor_link_id'),
                row.get('slug'),
                row.get('title'),
                row.get('sponsor_name'),
                _tracking_url_for_slug(row.get('slug')),
                row.get('destination_url'),
                row.get('disclosure_label'),
                row.get('notes'),
                row.get('is_active'),
                row.get('total_clicks'),
                row.get('clicks_7d'),
                row.get('clicks_30d'),
                row.get('unique_signed_in_users'),
                row.get('unique_user_agents'),
                row.get('unique_referrers'),
                row.get('first_click_at'),
                row.get('last_click_at'),
                row.get('created_at'),
                row.get('updated_at'),
            ]

    return _csv_response(
        'spouse-interview-sponsor-links.csv',
        headers,
        report_rows(),
    )


@api_bp.route('/admin/users/<user_id>/message', methods=['POST'])
@require_admin
def admin_send_user_message(user_id):
    data = request.get_json() or {}
    title = (data.get('title') or '').strip()[:200]
    message = (data.get('message') or '').strip()[:10000]
    send_email = bool(data.get('sendEmail', data.get('send_email', True)))

    if not title or not message:
        return jsonify({'error': 'Title and message are required'}), 400

    try:
        ok = _create_dashboard_message(
            user_id,
            title,
            message,
            {'created_from': 'admin_user_management', 'rich_content': True},
            send_email,
        )
        if not ok:
            return jsonify({'error': 'User not found'}), 404
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/robin/credits', methods=['GET'])
@require_auth
def current_user_robin_credits():
    user = request.current_user
    try:
        return jsonify({
            'success': True,
            'credits': get_user_robin_credit_summary(user['id']),
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/robin/credit-packs', methods=['GET'])
def public_robin_credit_packs():
    settings = saved_robin_usage_config()
    packs_feature_enabled = bool(settings.get('paidCreditPacksEnabled', False))
    checkout_enabled = bool(os.getenv('STRIPE_SECRET_KEY', '').strip()) and packs_feature_enabled
    if not checkout_enabled:
        return jsonify({
            'success': True,
            'checkoutEnabled': False,
            'dailyFreeMessages': settings.get('dailyFreeMessages'),
            'paidMessagesRollover': bool(settings.get('paidMessagesRollover', True)),
            'packsAvailable': False,
            'message': settings.get('creditPacksUnavailableMessage'),
            'packs': [],
        })

    packs = []
    for pack in settings.get('paidPacks') or []:
        try:
            messages = int(pack.get('messages') or 0)
            price_cents = int(pack.get('priceCents') or 0)
            expiration_days = int(pack.get('expirationDays') or settings.get('paidCreditExpirationDays') or 365)
        except (TypeError, ValueError):
            continue
        if not pack.get('active') or messages <= 0 or price_cents <= 0:
            continue
        packs.append({
            'id': pack.get('id'),
            'label': pack.get('label') or 'Robin Credit Pack',
            'messages': messages,
            'priceCents': price_cents,
            'expirationDays': expiration_days,
            'rollover': bool(pack.get('rollover', settings.get('paidMessagesRollover', True))),
        })

    return jsonify({
        'success': True,
        'checkoutEnabled': checkout_enabled,
        'dailyFreeMessages': settings.get('dailyFreeMessages'),
        'paidMessagesRollover': bool(settings.get('paidMessagesRollover', True)),
        'packsAvailable': bool(packs),
        'message': settings.get('creditPacksUnavailableMessage') if not packs else None,
        'packs': packs,
    })


@api_bp.route('/admin/users/<user_id>/robin-credits', methods=['GET', 'POST'])
@require_admin
def admin_user_robin_credits(user_id):
    user_uuid = _coerce_uuid_text(user_id)
    if not user_uuid:
        return jsonify({'error': 'Invalid user id'}), 400

    target_user = db.query_one("SELECT id::text AS id FROM users WHERE id = %s", (user_uuid,))
    if not target_user:
        return jsonify({'error': 'User not found'}), 404

    if request.method == 'GET':
        return jsonify({
            'success': True,
            'credits': get_user_robin_credit_summary(user_uuid),
        })

    data = request.get_json() or {}
    try:
        messages = int(data.get('messages') or 0)
    except (TypeError, ValueError):
        messages = 0
    if messages <= 0:
        return jsonify({'error': 'messages must be greater than 0'}), 400

    settings = saved_robin_usage_config()
    expiration_days = data.get('expirationDays') or settings.get('paidCreditExpirationDays') or 365
    summary = grant_robin_credits(
        user_uuid,
        messages,
        label=data.get('label') or 'Admin Robin credit grant',
        pack_id=data.get('packId') or data.get('pack_id'),
        expiration_days=expiration_days,
        rollover=bool(data.get('rollover', settings.get('paidMessagesRollover', True))),
        source_type='admin_grant',
        created_by=request.current_user.get('id'),
        metadata={
            'note': str(data.get('note') or '').strip()[:500],
            'source': 'admin_user_dashboard',
        },
    )
    return jsonify({'success': True, 'credits': summary})


@api_bp.route('/admin/users/<user_id>/activity', methods=['GET'])
@require_admin
def admin_user_activity(user_id):
    user_uuid = _coerce_uuid_text(user_id)
    if not user_uuid:
        return jsonify({'error': 'Invalid user id'}), 400

    user = db.query_one(
        """
        SELECT
            u.id::text AS id,
            u.email,
            u.created_at::text AS joined_at,
            u.updated_at::text AS updated_at,
            COALESCE(
                NULLIF(p.display_name, ''),
                NULLIF(TRIM(CONCAT_WS(' ', p.first_name, p.last_name)), ''),
                u.email
            ) AS display_name,
            COALESCE(p.role, 'user') AS role,
            COALESCE(p.is_active, true) AS is_active
        FROM users u
        LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = %s
        """,
        (user_uuid,),
    )
    if not user:
        return jsonify({'error': 'User not found'}), 404

    try:
        robin_credit_summary = get_user_robin_credit_summary(user_uuid)
        activity_rows = db.query_all(
            """
            SELECT kind, title, detail, occurred_at::text AS occurred_at, metadata
            FROM (
                SELECT
                    'robin'::text AS kind,
                    'Robin usage'::text AS title,
                    format('%%s turns across %%s sessions', total_turns, sessions_count)::text AS detail,
                    updated_at AS occurred_at,
                    jsonb_build_object(
                        'usageDate', usage_date::text,
                        'sessions', sessions_count,
                        'turns', total_turns
                    ) AS metadata
                FROM ai_daily_usage
                WHERE user_id = %s AND (sessions_count > 0 OR total_turns > 0)

                UNION ALL

                SELECT
                    'robin_credit'::text AS kind,
                    CASE event_type
                        WHEN 'usage' THEN 'Robin credit used'
                        WHEN 'purchase' THEN 'Robin credit purchase'
                        WHEN 'grant' THEN 'Robin credit grant'
                        WHEN 'void' THEN 'Robin credit voided'
                        ELSE 'Robin credit adjustment'
                    END::text AS title,
                    format('%%s message%%s', messages_delta, CASE WHEN ABS(messages_delta) = 1 THEN '' ELSE 's' END)::text AS detail,
                    created_at AS occurred_at,
                    COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
                        'grantId', grant_id::text,
                        'eventType', event_type,
                        'balanceAfter', balance_after,
                        'referenceId', reference_id
                    ) AS metadata
                FROM robin_credit_ledger
                WHERE user_id = %s

                UNION ALL

                SELECT
                    'pdf'::text AS kind,
                    'PDF download'::text AS title,
                    COALESCE(NULLIF(pdf_title, ''), pdf_filename)::text AS detail,
                    created_at AS occurred_at,
                    jsonb_build_object(
                        'filename', pdf_filename,
                        'topicId', topic_id,
                        'categoryId', category_id,
                        'source', download_source,
                        'status', event_status
                    ) AS metadata
                FROM pdf_download_events
                WHERE user_id = %s

                UNION ALL

                SELECT
                    CASE ne.event_type
                        WHEN 'opened' THEN 'message_opened'
                        WHEN 'clicked' THEN 'message_clicked'
                        WHEN 'dismissed' THEN 'message_dismissed'
                        ELSE 'message_event'
                    END::text AS kind,
                    CASE ne.event_type
                        WHEN 'opened' THEN 'Opened dashboard message'
                        WHEN 'clicked' THEN 'Clicked dashboard message'
                        WHEN 'dismissed' THEN 'Dismissed dashboard message'
                        ELSE 'Dashboard message activity'
                    END::text AS title,
                    n.title::text AS detail,
                    ne.created_at AS occurred_at,
                    COALESCE(ne.metadata, '{}'::jsonb) || jsonb_build_object(
                        'notificationId', n.id::text,
                        'notificationType', n.type,
                        'broadcastId', ne.broadcast_id::text
                    ) AS metadata
                FROM notification_events ne
                JOIN user_notifications n ON n.id = ne.notification_id
                WHERE ne.user_id = %s AND ne.event_type IN ('opened', 'clicked', 'dismissed')

                UNION ALL

                SELECT
                    'message_received'::text AS kind,
                    'Dashboard message received'::text AS title,
                    title::text AS detail,
                    created_at AS occurred_at,
                    jsonb_build_object(
                        'notificationId', id::text,
                        'notificationType', type,
                        'isRead', is_read,
                        'broadcastId', metadata->>'broadcast_id'
                    ) AS metadata
                FROM user_notifications
                WHERE user_id = %s

                UNION ALL

                SELECT
                    'support'::text AS kind,
                    'Support ticket'::text AS title,
                    (subject || ' (' || status || ')')::text AS detail,
                    created_at AS occurred_at,
                    jsonb_build_object('ticketId', id::text, 'status', status, 'category', category) AS metadata
                FROM support_tickets
                WHERE user_id = %s

                UNION ALL

                SELECT
                    'practice'::text AS kind,
                    'Question practice'::text AS title,
                    (question_id || ' in ' || topic_id)::text AS detail,
                    COALESCE(last_reviewed_at, updated_at, created_at) AS occurred_at,
                    jsonb_build_object(
                        'questionId', question_id,
                        'topicId', topic_id,
                        'comfortStatus', comfort_status,
                        'savedForLater', is_saved_for_later
                    ) AS metadata
                FROM question_states
                WHERE user_id = %s

                UNION ALL

                SELECT
                    'topic_progress'::text AS kind,
                    'Topic progress'::text AS title,
                    (topic_id || CASE WHEN is_completed THEN ' completed' ELSE ' started' END)::text AS detail,
                    updated_at AS occurred_at,
                    jsonb_build_object(
                        'topicId', topic_id,
                        'currentQuestionIndex', current_question_index,
                        'completed', is_completed
                    ) AS metadata
                FROM user_topic_progress
                WHERE user_id = %s
            ) activity
            WHERE occurred_at IS NOT NULL
            ORDER BY occurred_at DESC
            LIMIT 60
            """,
            (user_uuid, user_uuid, user_uuid, user_uuid, user_uuid, user_uuid, user_uuid, user_uuid),
        )

        daily_ai_usage = db.query_all(
            """
            SELECT
                usage_date::text AS usage_date,
                sessions_count,
                total_turns,
                updated_at::text AS updated_at
            FROM ai_daily_usage
            WHERE user_id = %s
            ORDER BY usage_date DESC
            LIMIT 14
            """,
            (user_uuid,),
        )

        recent_downloads = db.query_all(
            """
            SELECT
                id::text AS id,
                COALESCE(NULLIF(pdf_title, ''), pdf_filename) AS title,
                pdf_filename,
                topic_id,
                category_id,
                download_source,
                event_status,
                created_at::text AS created_at
            FROM pdf_download_events
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 12
            """,
            (user_uuid,),
        )

        message_stats = db.query_one(
            """
            SELECT
                COUNT(DISTINCT n.id) AS received,
                COUNT(DISTINCT n.id) FILTER (WHERE n.is_read = false) AS unread,
                COUNT(DISTINCT ne.notification_id) FILTER (WHERE ne.event_type = 'opened') AS opened,
                COUNT(DISTINCT ne.notification_id) FILTER (WHERE ne.event_type = 'clicked') AS clicked,
                MAX(n.created_at)::text AS last_received_at,
                MAX(ne.created_at)::text AS last_engaged_at
            FROM user_notifications n
            LEFT JOIN notification_events ne ON ne.notification_id = n.id
            WHERE n.user_id = %s
            """,
            (user_uuid,),
        ) or {}

        return jsonify({
            'user': user,
            'activity': activity_rows,
            'dailyAiUsage': daily_ai_usage,
            'recentDownloads': recent_downloads,
            'messageStats': message_stats,
            'robinCredits': robin_credit_summary,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/admin/users/<user_id>/activity.csv', methods=['GET'])
@require_admin
def admin_user_activity_csv(user_id):
    user_uuid = _coerce_uuid_text(user_id)
    if not user_uuid:
        return jsonify({'error': 'Invalid user id'}), 400

    user = db.query_one("SELECT email FROM users WHERE id = %s", (user_uuid,))
    if not user:
        return jsonify({'error': 'User not found'}), 404

    limit = request.args.get('limit', 500, type=int) or 500
    limit = max(1, min(limit, 2000))
    rows = db.query_all(
        """
        SELECT kind, title, detail, occurred_at::text AS occurred_at, metadata
        FROM (
            SELECT
                'robin'::text AS kind,
                'Robin usage'::text AS title,
                format('%%s turns across %%s sessions', total_turns, sessions_count)::text AS detail,
                updated_at AS occurred_at,
                jsonb_build_object(
                    'usageDate', usage_date::text,
                    'sessions', sessions_count,
                    'turns', total_turns
                ) AS metadata
            FROM ai_daily_usage
            WHERE user_id = %s AND (sessions_count > 0 OR total_turns > 0)

            UNION ALL

            SELECT
                'pdf'::text AS kind,
                'PDF download'::text AS title,
                COALESCE(NULLIF(pdf_title, ''), pdf_filename)::text AS detail,
                created_at AS occurred_at,
                jsonb_build_object(
                    'filename', pdf_filename,
                    'topicId', topic_id,
                    'categoryId', category_id,
                    'source', download_source,
                    'status', event_status
                ) AS metadata
            FROM pdf_download_events
            WHERE user_id = %s

            UNION ALL

            SELECT
                CASE ne.event_type
                    WHEN 'opened' THEN 'message_opened'
                    WHEN 'clicked' THEN 'message_clicked'
                    WHEN 'dismissed' THEN 'message_dismissed'
                    ELSE 'message_event'
                END::text AS kind,
                CASE ne.event_type
                    WHEN 'opened' THEN 'Opened dashboard message'
                    WHEN 'clicked' THEN 'Clicked dashboard message'
                    WHEN 'dismissed' THEN 'Dismissed dashboard message'
                    ELSE 'Dashboard message activity'
                END::text AS title,
                n.title::text AS detail,
                ne.created_at AS occurred_at,
                COALESCE(ne.metadata, '{}'::jsonb) || jsonb_build_object(
                    'notificationId', n.id::text,
                    'notificationType', n.type,
                    'broadcastId', ne.broadcast_id::text
                ) AS metadata
            FROM notification_events ne
            JOIN user_notifications n ON n.id = ne.notification_id
            WHERE ne.user_id = %s AND ne.event_type IN ('opened', 'clicked', 'dismissed')

            UNION ALL

            SELECT
                'message_received'::text AS kind,
                'Dashboard message received'::text AS title,
                title::text AS detail,
                created_at AS occurred_at,
                jsonb_build_object(
                    'notificationId', id::text,
                    'notificationType', type,
                    'isRead', is_read,
                    'broadcastId', metadata->>'broadcast_id'
                ) AS metadata
            FROM user_notifications
            WHERE user_id = %s

            UNION ALL

            SELECT
                'support'::text AS kind,
                'Support ticket'::text AS title,
                (subject || ' (' || status || ')')::text AS detail,
                created_at AS occurred_at,
                jsonb_build_object('ticketId', id::text, 'status', status, 'category', category) AS metadata
            FROM support_tickets
            WHERE user_id = %s

            UNION ALL

            SELECT
                'practice'::text AS kind,
                'Question practice'::text AS title,
                (question_id || ' in ' || topic_id)::text AS detail,
                COALESCE(last_reviewed_at, updated_at, created_at) AS occurred_at,
                jsonb_build_object(
                    'questionId', question_id,
                    'topicId', topic_id,
                    'comfortStatus', comfort_status,
                    'savedForLater', is_saved_for_later
                ) AS metadata
            FROM question_states
            WHERE user_id = %s

            UNION ALL

            SELECT
                'topic_progress'::text AS kind,
                'Topic progress'::text AS title,
                (topic_id || CASE WHEN is_completed THEN ' completed' ELSE ' started' END)::text AS detail,
                updated_at AS occurred_at,
                jsonb_build_object(
                    'topicId', topic_id,
                    'currentQuestionIndex', current_question_index,
                    'completed', is_completed
                ) AS metadata
            FROM user_topic_progress
            WHERE user_id = %s
        ) activity
        WHERE occurred_at IS NOT NULL
        ORDER BY occurred_at DESC
        LIMIT %s
        """,
        (user_uuid, user_uuid, user_uuid, user_uuid, user_uuid, user_uuid, user_uuid, limit),
    )
    headers = ['user_id', 'email', 'kind', 'title', 'detail', 'occurred_at', 'metadata']
    return _csv_response(
        'spouse-interview-user-timeline.csv',
        headers,
        (
            [
                user_uuid,
                user.get('email'),
                row.get('kind'),
                row.get('title'),
                row.get('detail'),
                row.get('occurred_at'),
                row.get('metadata'),
            ]
            for row in rows
        ),
    )


def _support_ticket_with_user(ticket_id):
    return db.query_one(
        """
        SELECT t.*, u.email AS user_email
        FROM support_tickets t
        JOIN users u ON u.id = t.user_id
        WHERE t.id = %s
        """,
        (ticket_id,),
    )


def _send_support_admin_emails(ticket, context, refund_signal):
    sent = 0
    for recipient in admin_recipients():
        email = recipient.get('email')
        if not email:
            continue
        try:
            send_support_ticket_admin_email(email, ticket, context)
            if refund_signal:
                send_refund_alert_admin_email(email, ticket, context)
            sent += 1
        except Exception:
            pass
    return sent


def _support_conversation_item(role, content, source='support_ai', metadata=None):
    return {
        'role': role,
        'content': str(content or '').strip()[:2400],
        'source': source,
        'createdAt': utc_now_iso(),
        'metadata': metadata or {},
    }


def _support_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in {'1', 'true', 'yes', 'y'}
    if value is None:
        return default
    return bool(value)


def _run_support_ai(category, subject, message, context, conversation):
    provider = _select_default_provider()
    model = _default_model_for_provider(provider)
    messages = _build_support_messages(category, subject, message, context, conversation)
    timeout_seconds = _role_fallback_timeout('support')
    try:
        response_text, actual_provider, actual_model, fallback_used, provider_errors = _call_provider_with_fallback(
            provider,
            model,
            messages,
            timeout_seconds=timeout_seconds,
        )
        normalized = _normalize_support_response(response_text, actual_provider, actual_model, category)
        normalized['requestedProvider'] = provider
        normalized['requestedModel'] = model
        normalized['providerFallback'] = fallback_used
        normalized['providerTimeoutSeconds'] = timeout_seconds
        normalized['providerErrors'] = provider_errors[-2:]
        return normalized
    except Exception as e:
        return _support_fallback_response(category, subject, message, str(e))


def _support_needs_admin(ai_response, category, refund_signal, cancel_signal):
    urgency = str((ai_response or {}).get('urgency') or '').lower()
    can_resolve = _support_bool((ai_response or {}).get('canResolve'), True)
    needs_review = _support_bool((ai_response or {}).get('needsAdminReview'), False)
    should_create_ticket = _support_bool((ai_response or {}).get('shouldCreateTicket'), False)
    return bool(
        urgency == 'high'
        or needs_review
        or not can_resolve
        or refund_signal
        or cancel_signal
        or (category in {'billing', 'refund'} and should_create_ticket)
    )


NOTIFICATION_EVENT_TYPES = {'delivered', 'opened', 'clicked', 'dismissed'}


def _coerce_uuid_text(value):
    if not value:
        return None
    try:
        return str(uuid.UUID(str(value)))
    except (TypeError, ValueError, AttributeError):
        return None


def _compact_event_metadata(value):
    if not isinstance(value, dict):
        return {}
    cleaned = {}
    for key, item in list(value.items())[:20]:
        clean_key = str(key or '')[:80]
        if not clean_key:
            continue
        if isinstance(item, (str, int, float, bool)) or item is None:
            cleaned[clean_key] = item
        elif isinstance(item, (dict, list)):
            cleaned[clean_key] = item
        else:
            cleaned[clean_key] = str(item)[:500]
    return cleaned


def _notification_broadcast_id(notification_row):
    metadata = parse_jsonish((notification_row or {}).get('metadata'), {})
    return _coerce_uuid_text(metadata.get('broadcast_id'))


def _record_notification_event(notification_id, event_type, user_id, broadcast_id=None, metadata=None):
    if event_type not in NOTIFICATION_EVENT_TYPES:
        return False
    notification_uuid = _coerce_uuid_text(notification_id)
    user_uuid = _coerce_uuid_text(user_id)
    broadcast_uuid = _coerce_uuid_text(broadcast_id)
    if not notification_uuid or not user_uuid:
        return False
    try:
        db.execute(
            """
            INSERT INTO notification_events (
              notification_id, broadcast_id, user_id, event_type, metadata
            )
            VALUES (%s, %s, %s, %s, %s::jsonb)
            """,
            (
                notification_uuid,
                broadcast_uuid,
                user_uuid,
                event_type,
                json_dumps(_compact_event_metadata(metadata)),
            ),
        )
        return True
    except Exception:
        return False


def _dismiss_notification(notification_id, user_id):
    try:
        db.execute("ALTER TABLE user_notifications ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMPTZ")
        db.execute(
            """
            UPDATE user_notifications
            SET dismissed_at = now(),
                is_read = true,
                updated_at = now()
            WHERE id = %s AND user_id = %s
            """,
            (notification_id, user_id),
        )
    except Exception:
        pass


def _broadcast_analytics_by_id(broadcast_ids):
    ids = [item for item in (_coerce_uuid_text(value) for value in broadcast_ids) if item]
    if not ids:
        return {}
    try:
        rows = db.query_all(
            """
            SELECT
              broadcast_id::text AS broadcast_id,
              COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'delivered') AS delivered,
              COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'opened') AS opened,
              COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'clicked') AS clicked,
              COUNT(DISTINCT notification_id) FILTER (WHERE event_type = 'dismissed') AS dismissed,
              COUNT(*) FILTER (WHERE event_type = 'clicked') AS click_events
            FROM notification_events
            WHERE broadcast_id::text = ANY(%s)
            GROUP BY broadcast_id
            """,
            (ids,),
        )
    except Exception:
        return {}
    return {str(row.get('broadcast_id')): row for row in rows}


def _broadcast_analytics(row, stats=None):
    stats = stats or {}
    sent_count = int((row or {}).get('sent_count') or 0)
    delivered = max(sent_count, int(stats.get('delivered') or 0))
    opened = int(stats.get('opened') or 0)
    clicked = int(stats.get('clicked') or 0)
    dismissed = int(stats.get('dismissed') or 0)
    click_events = int(stats.get('click_events') or clicked)
    return {
        'delivered': delivered,
        'opened': opened,
        'clicked': clicked,
        'dismissed': dismissed,
        'clickEvents': click_events,
        'openRate': round((opened / delivered) * 100, 1) if delivered else 0,
        'clickRate': round((clicked / delivered) * 100, 1) if delivered else 0,
    }


def _serialize_broadcast(row, analytics=None):
    row = row or {}
    created_at = row.get('created_at')
    updated_at = row.get('updated_at')
    scheduled_at = row.get('scheduled_at')
    return {
        'id': str(row.get('id') or ''),
        'title': row.get('title') or '',
        'message': row.get('message') or '',
        'audienceType': row.get('audience_type') or 'all_users',
        'isActive': bool(row.get('is_active', True)),
        'sentCount': int(row.get('sent_count') or 0),
        'scheduledAt': scheduled_at.isoformat() if hasattr(scheduled_at, 'isoformat') else scheduled_at,
        'sendEmail': bool(row.get('send_email', True)),
        'analytics': _broadcast_analytics(row, analytics),
        'createdBy': str(row.get('created_by') or '') or None,
        'createdAt': created_at.isoformat() if hasattr(created_at, 'isoformat') else created_at,
        'updatedAt': updated_at.isoformat() if hasattr(updated_at, 'isoformat') else updated_at,
    }


def _broadcast_recipients(audience_type):
    return db.query_all(
        """
        SELECT u.id::text AS user_id, u.email,
               COALESCE(ai.total_turns_today, 0) AS robin_turns_today,
               COALESCE(ns.unread_messages, 0) AS unread_messages
        FROM users u
        LEFT JOIN (
            SELECT user_id, SUM(total_turns) AS total_turns_today
            FROM ai_daily_usage
            WHERE usage_date = CURRENT_DATE
            GROUP BY user_id
        ) ai ON ai.user_id = u.id
        LEFT JOIN (
            SELECT user_id, COUNT(*) AS unread_messages
            FROM user_notifications
            WHERE is_read = false
            GROUP BY user_id
        ) ns ON ns.user_id = u.id
        WHERE COALESCE(u.email, '') <> ''
          AND CASE %s
            WHEN 'all_users' THEN true
            WHEN 'free_users' THEN true
            WHEN 'robin_users' THEN COALESCE(ai.total_turns_today, 0) > 0
            WHEN 'unread_message_users' THEN COALESCE(ns.unread_messages, 0) > 0
            WHEN 'reengagement_users' THEN COALESCE(u.updated_at, u.created_at) < now() - INTERVAL '7 days'
            ELSE true
          END
        LIMIT 2000
        """,
        (audience_type or 'all_users',),
    )


def _publish_broadcast_row(row):
    if not row or not row.get('is_active', True):
        return 0

    count = 0
    for recipient in _broadcast_recipients(row.get('audience_type') or 'all_users'):
        try:
            notification_id = db.call_function('create_user_notification', (
                recipient['user_id'],
                'broadcast',
                row.get('title') or 'Dashboard message',
                row.get('message') or '',
                '/messages',
                json_dumps({
                    'broadcast_id': str(row.get('id') or ''),
                    'audience_type': row.get('audience_type') or 'all_users',
                    'rich_content': True,
                }),
            ))
            _record_notification_event(
                notification_id,
                'delivered',
                recipient['user_id'],
                row.get('id'),
                {'source': 'admin_broadcast', 'send_email': bool(row.get('send_email', True))},
            )
            count += 1
            if row.get('send_email', True):
                send_dashboard_message_email(
                    recipient['email'],
                    row.get('title') or 'New Spouse Interview dashboard message',
                    row.get('message') or '',
                    None,
                    str(row.get('id') or ''),
                )
        except Exception:
            continue

    try:
        db.execute(
            """
            UPDATE broadcast_messages
            SET sent_count = %s, updated_at = now()
            WHERE id = %s
            """,
            (count, row.get('id')),
        )
    except Exception:
        pass
    return count


def _publish_due_broadcast_rows():
    rows = db.query_all(
        """
        SELECT id, title, message, audience_type, is_active, sent_count,
               scheduled_at, send_email, created_by, created_at, updated_at
        FROM broadcast_messages
        WHERE is_active = true
          AND COALESCE(sent_count, 0) = 0
          AND scheduled_at IS NOT NULL
          AND scheduled_at <= now()
        ORDER BY scheduled_at ASC
        LIMIT 25
        """
    )
    total = 0
    for row in rows:
        total += _publish_broadcast_row(row)
    return rows, total


@api_bp.route('/admin/broadcasts', methods=['GET', 'POST'])
@require_admin
def admin_broadcasts_endpoint():
    user = request.current_user
    if request.method == 'GET':
      _publish_due_broadcast_rows()
      rows = db.query_all(
          """
          SELECT id, title, message, audience_type, is_active, sent_count,
                 scheduled_at, send_email, created_by, created_at, updated_at
          FROM broadcast_messages
          ORDER BY created_at DESC
          LIMIT 200
          """
      )
      analytics = _broadcast_analytics_by_id([row.get('id') for row in rows])
      return jsonify({
          'success': True,
          'broadcasts': [
              _serialize_broadcast(row, analytics.get(str(row.get('id'))))
              for row in rows
          ],
      })

    data = request.get_json() or {}
    title = (data.get('title') or '').strip()[:200]
    message = (data.get('message') or '').strip()[:10000]
    audience_type = (data.get('audienceType') or data.get('audience_type') or 'all_users').strip()
    legacy_audience_map = {
        'trial_users': 'free_users',
        'premium_users': 'robin_users',
        'expired_users': 'reengagement_users',
    }
    audience_type = legacy_audience_map.get(audience_type, audience_type)
    if audience_type not in {'all_users', 'free_users', 'robin_users', 'unread_message_users', 'reengagement_users'}:
        audience_type = 'all_users'
    scheduled_at = data.get('scheduledAt') or data.get('scheduled_at') or None
    send_email = bool(data.get('sendEmail', data.get('send_email', True)))
    publish_now = bool(data.get('publishNow', data.get('publish_now', True)))

    if not title or not message:
        return jsonify({'error': 'Title and message are required'}), 400

    try:
        row = db.execute_returning(
            """
            INSERT INTO broadcast_messages (
              title, message, audience_type, is_active, scheduled_at,
              send_email, created_by, metadata
            )
            VALUES (%s, %s, %s, true, %s, %s, %s, %s::jsonb)
            RETURNING id, title, message, audience_type, is_active, sent_count,
                      scheduled_at, send_email, created_by, created_at, updated_at
            """,
            (
                title,
                message,
                audience_type,
                scheduled_at,
                send_email,
                user['id'],
                json_dumps({'rich_content': True, 'created_from': 'admin_portal'}),
            ),
        )
        sent_count = _publish_broadcast_row(row) if publish_now else 0
        if sent_count:
            row = db.query_one(
                """
                SELECT id, title, message, audience_type, is_active, sent_count,
                       scheduled_at, send_email, created_by, created_at, updated_at
                FROM broadcast_messages
                WHERE id = %s
                """,
                (row['id'],),
            )
        analytics = _broadcast_analytics_by_id([row.get('id')])
        return jsonify({
            'success': True,
            'broadcast': _serialize_broadcast(row, analytics.get(str(row.get('id')))),
            'sentCount': sent_count,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/admin/broadcasts/<broadcast_id>/publish', methods=['POST'])
@require_admin
def publish_admin_broadcast(broadcast_id):
    row = db.query_one(
        """
        SELECT id, title, message, audience_type, is_active, sent_count,
               scheduled_at, send_email, created_by, created_at, updated_at
        FROM broadcast_messages
        WHERE id = %s
        """,
        (broadcast_id,),
    )
    if not row:
        return jsonify({'error': 'Broadcast not found'}), 404
    try:
        sent_count = _publish_broadcast_row(row)
        return jsonify({'success': True, 'sentCount': sent_count})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/admin/broadcasts/publish-due', methods=['POST'])
@require_admin
def publish_due_admin_broadcasts():
    rows, total = _publish_due_broadcast_rows()
    return jsonify({'success': True, 'published': len(rows), 'sentCount': total})


@api_bp.route('/broadcasts/publish-due', methods=['POST'])
@require_auth
def publish_due_user_broadcasts():
    rows, total = _publish_due_broadcast_rows()
    return jsonify({'success': True, 'published': len(rows), 'sentCount': total})


@api_bp.route('/notifications/<notification_id>/events', methods=['POST'])
@require_auth
def record_notification_event_endpoint(notification_id):
    user = request.current_user
    notification_uuid = _coerce_uuid_text(notification_id)
    if not notification_uuid:
        return jsonify({'error': 'Invalid notification id'}), 400

    data = request.get_json() or {}
    event_type = str(data.get('eventType') or data.get('event_type') or '').strip().lower()
    if event_type not in {'opened', 'clicked', 'dismissed'}:
        return jsonify({'error': 'Unsupported notification event'}), 400

    notification = db.query_one(
        """
        SELECT id::text AS id, user_id::text AS user_id, metadata
        FROM user_notifications
        WHERE id = %s AND user_id = %s
        """,
        (notification_uuid, user['id']),
    )
    if not notification:
        return jsonify({'error': 'Notification not found'}), 404

    metadata = _compact_event_metadata(data.get('metadata') if isinstance(data.get('metadata'), dict) else {})
    metadata['source'] = str(metadata.get('source') or 'notification_panel')[:80]
    recorded = _record_notification_event(
        notification_uuid,
        event_type,
        user['id'],
        _notification_broadcast_id(notification),
        metadata,
    )
    if event_type == 'dismissed':
        _dismiss_notification(notification_uuid, user['id'])
    return jsonify({'success': True, 'recorded': recorded})


@api_bp.route('/support/tickets', methods=['POST'])
def create_support_ticket_endpoint():
    return _free_app_workflow_retired_response('support ticket')

@api_bp.route('/support/tickets/<ticket_id>/reply', methods=['POST'])
def user_reply_support_ticket(ticket_id):
    return _free_app_workflow_retired_response('support ticket reply')

@api_bp.route('/admin/support/tickets', methods=['GET', 'POST'])
def admin_support_tickets():
    return _free_app_workflow_retired_response('admin support ticket')

@api_bp.route('/admin/support/tickets/<ticket_id>/reply', methods=['POST'])
def admin_reply_support_ticket(ticket_id):
    return _free_app_workflow_retired_response('admin support ticket reply')

@api_bp.route('/admin/support/tickets/<ticket_id>/close', methods=['POST'])
def admin_close_support_ticket(ticket_id):
    return _free_app_workflow_retired_response('admin support ticket close')

@api_bp.route('/admin/memory-status', methods=['GET'])
@require_admin
def admin_memory_status():
    try:
        answer_stats = db.query_one(
            """
            SELECT
              COUNT(*) AS total_candidates,
              COUNT(*) FILTER (WHERE review_status = 'pending') AS pending_review,
              COUNT(*) FILTER (WHERE review_status = 'approved') AS approved_count,
              COUNT(*) FILTER (WHERE approved_for_publication = true) AS approved_for_publication,
              COUNT(*) FILTER (WHERE published_slug IS NOT NULL) AS published_examples,
              COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS captured_today
            FROM answer_example_candidates
            """
        ) or {}
        page_stats = db.query_one(
            """
            SELECT
              COUNT(*) AS total_pages,
              COUNT(*) FILTER (WHERE status = 'approved') AS approved_pages,
              COUNT(*) FILTER (WHERE is_published = true) AS published_pages,
              COUNT(*) FILTER (WHERE include_in_sitemap = true) AS sitemap_pages,
              COUNT(*) FILTER (WHERE noindex_override = true) AS noindex_pages
            FROM seo_expansion_pages
            """
        ) or {}
        question_stats = db.query_one(
            """
            SELECT
              COUNT(*) AS tracked_question_states,
              COUNT(DISTINCT user_id) AS users_with_question_state
            FROM question_states
            WHERE COALESCE(comfort_status, 'not-seen') <> 'not-seen'
               OR is_saved_for_later = true
            """
        ) or {}
        agent_memory_stats = db.query_one(
            """
            SELECT
              COUNT(*) AS total_entries,
              COUNT(DISTINCT user_id) AS users_with_agent_memory,
              COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) AS captured_today
            FROM dashboard_agent_memory
            """
        ) or {}
        plan_rows = db.query_all(
            """
            SELECT plan_type, name, max_turns_per_session, max_sessions_per_day,
                   can_use_ai, can_choose_provider, can_choose_model
            FROM plan_config
            ORDER BY CASE plan_type
              WHEN 'trial' THEN 0 WHEN 'monthly' THEN 1
              WHEN 'interviewPass' THEN 2 WHEN 'lifetime' THEN 3 ELSE 4 END
            """
        )
        return jsonify({
            'answerCandidates': answer_stats,
            'seoExpansionPages': page_stats,
            'questionStateIndex': question_stats,
            'dashboardAgentMemory': agent_memory_stats,
            'planLimits': plan_rows,
            'notes': [
                'AI interview answers are sanitized and stored as answer_example_candidates for manual admin review.',
                'Robin chat questions and answers are saved in dashboard_agent_memory with searchable indexes.',
                'Approved answer candidates can be promoted later, but original private answers are not published automatically.',
                'SEO expansion pages remain noindex/sitemap-gated until approved and published.',
            ],
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@api_bp.route('/process-refund', methods=['POST'])
def process_refund():
    return _free_app_workflow_retired_response('refund processing')

@api_bp.route('/trigger-rebuild', methods=['POST'])
@require_admin
def trigger_rebuild():
    import requests as http_requests
    user = request.current_user
    data = request.get_json() or {}
    coolify_url = os.getenv('COOLIFY_WEBHOOK_URL')

    if not coolify_url:
        return jsonify({'error': 'Rebuild not configured'}), 503

    from datetime import datetime, timezone
    triggered_at = datetime.now(timezone.utc).isoformat()
    reason = data.get('reason', 'admin_triggered')
    source = data.get('source', 'admin_dashboard')

    try:
        resp = http_requests.post(coolify_url, json={
            'triggered_at': triggered_at,
            'triggered_by': user['id'],
            'source': source,
            'reason': reason,
        }, timeout=10)
        resp.raise_for_status()

        db.call_function('record_rebuild_attempt', (
            user['id'], triggered_at, 'triggered', reason, source, None
        ))

        est_completion = datetime.now(timezone.utc).isoformat()
        return jsonify({
            'success': True,
            'message': 'Rebuild triggered successfully',
            'triggeredAt': triggered_at,
            'estimatedCompletion': est_completion,
        })
    except Exception as e:
        db.call_function('record_rebuild_attempt', (
            user['id'], triggered_at, 'error', reason, source, str(e)
        ))
        return jsonify({'error': f'Failed to trigger rebuild: {str(e)}'}), 502


import os as _os
