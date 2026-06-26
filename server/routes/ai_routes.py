import os
import json
import re
import uuid
import requests as http_requests
from datetime import datetime, timezone
from flask import Blueprint, request, jsonify
from auth import optional_auth, require_auth, require_admin
import db
from admin_settings import get_admin_setting, saved_ai_runtime_config, saved_robin_usage_config
from robin_credits import consume_robin_credits, get_user_robin_credit_summary
from support_service import (
    get_user_support_context,
    has_refund_signal,
    json_dumps,
    normalize_ticket_row,
    parse_jsonish,
)

ai_bp = Blueprint('ai', __name__)

OPENAI_API_KEY = os.getenv('OPENAI_API_KEY', '')
ANTHROPIC_API_KEY = os.getenv('ANTHROPIC_API_KEY', '')
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY', '')
NVIDIA_API_KEY = os.getenv('NVIDIA_API_KEY', '')
MINIMAX_API_KEY = os.getenv('MINIMAX_API_KEY', '')
MINIMAX_BASE_URL = os.getenv('MINIMAX_BASE_URL', 'https://api.minimax.io/v1')
MINIMAX_DEFAULT_MODEL = os.getenv('MINIMAX_DEFAULT_MODEL', 'MiniMax-M3')

VALID_FEEDBACK_LABELS = {
    'clear_and_natural',
    'could_use_more_detail',
    'worth_reviewing_together',
    'a_little_vague',
    'review_gently',
}

AI_ROLE_IDS = {'robin', 'support', 'admin_support'}
AI_ROLE_FALLBACK_TIMEOUT_DEFAULTS = {
    'robin': 25,
    'support': 15,
    'admin_support': 25,
}
AI_FALLBACK_TIMEOUT_MIN = 8
AI_FALLBACK_TIMEOUT_MAX = 120

SUPPORT_SCOPE_KEYWORDS = (
    'refund', 'billing', 'bill', 'payment', 'charge', 'charged', 'stripe',
    'subscription', 'cancel my plan', 'cancel subscription', 'upgrade',
    'login', 'log in', 'password', 'email change', 'account access',
    'support ticket', 'admin', 'technical', 'bug', 'error', 'pdf download',
    'download problem', 'app issue', 'not working',
)


def _free_app_support_ai_retired_response(workflow='support AI'):
    return jsonify({
        'success': False,
        'code': 'FREE_APP_SUPPORT_AI_RETIRED',
        'error': f'The legacy {workflow} workflow is retired in the free app.',
        'message': (
            'Use Robin for interview practice and a simple contact email for direct help. '
            'The full support-ticket AI workflow is disabled.'
        ),
    }), 410


def _model_ref(provider, model):
    provider_id = _normalize_provider_id(provider)
    model_id = str(model or '').strip()
    if not provider_id or not model_id:
        return ''
    return f'{provider_id}::{model_id}'


def _parse_model_ref(value):
    text = str(value or '').strip()
    if not text:
        return '', ''
    if '::' in text:
        provider, model = text.split('::', 1)
        return _normalize_provider_id(provider), model.strip()
    return '', text


def _role_assignment(role):
    role_id = str(role or '').strip().lower()
    if role_id not in AI_ROLE_IDS:
        role_id = 'robin'
    config = saved_ai_runtime_config()
    roles = config.get('roleAssignments') if isinstance(config.get('roleAssignments'), dict) else {}
    role_config = roles.get(role_id) if isinstance(roles, dict) else {}
    return role_config if isinstance(role_config, dict) else {}


def _clamp_timeout_seconds(value, default_value):
    try:
        seconds = int(value)
    except (TypeError, ValueError):
        seconds = int(default_value)
    return max(AI_FALLBACK_TIMEOUT_MIN, min(AI_FALLBACK_TIMEOUT_MAX, seconds))


def _role_fallback_timeout(role):
    role_id = str(role or '').strip().lower()
    default_timeout = AI_ROLE_FALLBACK_TIMEOUT_DEFAULTS.get(role_id, 25)
    role_config = _role_assignment(role_id)
    return _clamp_timeout_seconds(
        role_config.get('fallbackTimeoutSeconds') or role_config.get('fallback_timeout_seconds'),
        default_timeout,
    )


def _append_candidate(candidates, seen, provider, model):
    provider_id = _normalize_provider_id(provider)
    model_id = str(model or '').strip()
    if not provider_id:
        return
    if not model_id:
        model_id = _default_model_for_provider(provider_id)
    key = (provider_id, model_id)
    if key not in seen:
        seen.add(key)
        candidates.append(key)


def _looks_complex_for_robin(prompt_text):
    text = str(prompt_text or '').lower()
    complex_terms = (
        'denied', 'denial', 'rfe', 'noid', 'waiver', 'criminal', 'arrest',
        'overstay', 'deport', 'removal', 'fraud', 'misrepresentation',
        'prior marriage', 'divorce', 'separate', 'separated', 'affidavit',
        'i-130', 'i-485', 'i-751', 'joint sponsor', 'tax transcript',
        'lawyer', 'attorney', 'legal',
    )
    return len(text) > 420 or text.count('?') >= 2 or any(term in text for term in complex_terms)


def _role_model_refs(role_config, prompt_text=''):
    default_ref = str(role_config.get('defaultModelRef') or '').strip()
    fallback_refs = list(role_config.get('fallbackModelRefs') if isinstance(role_config.get('fallbackModelRefs'), list) else [])
    enabled_refs = list(role_config.get('enabledModelRefs') if isinstance(role_config.get('enabledModelRefs'), list) else [])
    ordered = []
    for ref in [default_ref, *fallback_refs, *enabled_refs]:
        ref = str(ref or '').strip()
        if ref and ref not in ordered:
            ordered.append(ref)

    policy = str(role_config.get('routingPolicy') or '').strip().lower()
    if policy == 'complexity' and _looks_complex_for_robin(prompt_text) and len(ordered) > 1:
        first_fallback = next((ref for ref in fallback_refs if ref and ref != default_ref), None)
        if first_fallback and first_fallback in ordered:
            ordered = [first_fallback, *[ref for ref in ordered if ref != first_fallback]]
    return ordered


def _role_model_candidates(role, preferred_provider='', preferred_model='', prompt_text=''):
    candidates = []
    seen = set()
    if preferred_provider:
        _append_candidate(candidates, seen, preferred_provider, preferred_model)

    role_config = _role_assignment(role)
    for ref in _role_model_refs(role_config, prompt_text):
        provider, model = _parse_model_ref(ref)
        _append_candidate(candidates, seen, provider, model)

    if not candidates:
        configured_default = _select_default_provider()
        _append_candidate(candidates, seen, configured_default, _default_model_for_provider(configured_default))
    return candidates


def _select_role_provider_model(role, data=None):
    data = data if isinstance(data, dict) else {}
    explicit_provider = data.get('provider')
    explicit_model = data.get('modelId') or data.get('model')
    prompt_text = data.get('question') or data.get('message') or data.get('subject') or ''
    candidates = _role_model_candidates(role, explicit_provider, explicit_model, prompt_text)
    if candidates:
        return candidates[0]
    provider = _select_default_provider()
    return provider, _default_model_for_provider(provider)


def _call_role_provider_with_fallback(role, preferred_provider, preferred_model, messages, prompt_text=''):
    errors = []
    candidates = _role_model_candidates(role, preferred_provider, preferred_model, prompt_text)
    timeout_seconds = _role_fallback_timeout(role)
    for index, (provider, model) in enumerate(candidates):
        if not _provider_configured(provider):
            errors.append({
                'provider': provider,
                'model': model,
                'message': 'API key is not configured',
            })
            continue
        try:
            return _call_provider(provider, model, messages, timeout_seconds), provider, model, index > 0, errors
        except Exception as exc:
            errors.append({
                'provider': provider,
                'model': model,
                'timeoutSeconds': timeout_seconds,
                'message': str(exc)[:240],
            })

    for provider in _provider_priority(preferred_provider):
        if not _provider_configured(provider):
            continue
        model = preferred_model if provider == preferred_provider and preferred_model else _default_model_for_provider(provider)
        try:
            return _call_provider(provider, model, messages, timeout_seconds), provider, model, True, errors
        except Exception as exc:
            errors.append({
                'provider': provider,
                'model': model,
                'timeoutSeconds': timeout_seconds,
                'message': str(exc)[:240],
            })
    raise ValueError('No configured AI provider was able to complete the request')


def _robin_scope_redirect_answer(question):
    text = str(question or '').lower()
    if not any(keyword in text for keyword in SUPPORT_SCOPE_KEYWORDS):
        return ''
    return (
        "I can help with USCIS marriage interview preparation, relationship-practice questions, "
        "and general immigration preparation. This looks like a billing, account, refund, or app-support "
        "question, so the best next step is to use the contact form or dashboard messages for help "
        "from Spouse Interview."
    )


def _lawyer_directory_config():
    raw = get_admin_setting('lawyer_directory_config', {}) or {}
    return raw if isinstance(raw, dict) else {}


@ai_bp.route('/interview-turn', methods=['POST'])
@optional_auth
def ai_interview_turn():
    user = request.current_user
    data = request.get_json() or {}

    provider, model = _select_role_provider_model('robin', data)
    topic_id = data.get('topicId')
    session_id = data.get('sessionId')

    limits = _check_usage_limits(user)
    if limits and not limits.get('allowed', False):
        return jsonify({
            'success': False,
            'error': {
                'code': 'PLAN_LIMIT_REACHED',
                'message': limits.get('reason', 'Usage limit reached'),
                'userMessage': limits.get('reason', 'Usage limit reached. Upgrade for unlimited practice.'),
                'upgradeRecommended': True,
            },
        }), 429

    if not session_id and user:
        session_id = _record_session_start(user, provider, model, topic_id)

    messages = data.get('messages')
    if not messages:
        messages = _build_interview_messages(data)

    try:
        response_text, actual_provider, actual_model, fallback_used, provider_errors = _call_role_provider_with_fallback(
            'robin',
            provider,
            model,
            messages,
            data.get('answer') or data.get('question') or data.get('questionText') or '',
        )
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'code': 'PROVIDER_ERROR',
                'message': f'AI provider error: {str(e)}',
                'userMessage': 'AI interview is temporarily unavailable. Please try again or choose another provider.',
            },
        }), 500

    post_turn_limits = _record_turn_and_refresh_limits(user, session_id, limits)

    normalized = _normalize_ai_response(response_text, actual_provider, actual_model, data)
    normalized['sessionId'] = str(session_id or data.get('anonymousId') or uuid.uuid4())
    normalized['turnsRemaining'] = _turns_remaining(post_turn_limits)
    normalized['planType'] = post_turn_limits.get('plan_type') if isinstance(post_turn_limits, dict) else ('trial' if not user else None)
    normalized['requestedProvider'] = provider
    normalized['requestedModel'] = model
    normalized['providerFallback'] = fallback_used
    normalized['providerTimeoutSeconds'] = _role_fallback_timeout('robin')
    normalized['providerErrors'] = provider_errors[-2:]

    return jsonify({
        'success': True,
        'data': normalized,
    })


@ai_bp.route('/support-assist', methods=['POST'])
@optional_auth
def support_assist():
    return _free_app_support_ai_retired_response('support assistant')
    user = request.current_user
    data = request.get_json() or {}
    category = (data.get('category') or 'other')[:40]
    subject = (data.get('subject') or '')[:200]
    message = (data.get('message') or '')[:4000]
    conversation = data.get('conversation') or data.get('supportConversation') or []

    if not subject and not message:
        return jsonify({'error': 'Tell the assistant what you need help with first.'}), 400

    context = get_user_support_context(user['id']) if user else {}
    provider, model = _select_role_provider_model('support', data)
    messages = _build_support_messages(category, subject, message, context, conversation)

    try:
        response_text, actual_provider, actual_model, fallback_used, provider_errors = _call_role_provider_with_fallback(
            'support',
            provider,
            model,
            messages,
            f'{subject}\n{message}',
        )
        normalized = _normalize_support_response(response_text, actual_provider, actual_model, category)
        normalized['requestedProvider'] = provider
        normalized['requestedModel'] = model
        normalized['providerFallback'] = fallback_used
        normalized['providerTimeoutSeconds'] = _role_fallback_timeout('support')
        normalized['providerErrors'] = provider_errors[-2:]
    except Exception as e:
        normalized = _support_fallback_response(category, subject, message, str(e))

    return jsonify({'success': True, 'data': normalized})


@ai_bp.route('/support-ticket-draft', methods=['POST'])
@require_admin
def support_ticket_draft():
    return _free_app_support_ai_retired_response('admin support draft')
    data = request.get_json() or {}
    ticket_id = data.get('ticketId') or data.get('ticket_id')
    if not ticket_id:
        return jsonify({'error': 'ticketId is required'}), 400

    ticket = db.query_one(
        """
        SELECT t.*, u.email AS user_email
        FROM support_tickets t
        JOIN users u ON u.id = t.user_id
        WHERE t.id = %s
        """,
        (ticket_id,),
    )
    if not ticket:
        return jsonify({'error': 'Ticket not found'}), 404

    context = get_user_support_context(str(ticket['user_id']))
    triage = parse_jsonish(ticket.get('ai_triage'), {})
    refund_signal = has_refund_signal(
        ticket.get('category') or 'other',
        ticket.get('subject') or '',
        ticket.get('message') or '',
        triage,
    )
    provider, model = _select_role_provider_model('admin_support', data)
    messages = _build_admin_support_messages(ticket, context, refund_signal)

    try:
        response_text, actual_provider, actual_model, fallback_used, provider_errors = _call_role_provider_with_fallback(
            'admin_support',
            provider,
            model,
            messages,
            f"{ticket.get('subject') or ''}\n{ticket.get('message') or ''}",
        )
        normalized = _normalize_admin_support_response(response_text, actual_provider, actual_model)
        normalized['requestedProvider'] = provider
        normalized['requestedModel'] = model
        normalized['providerFallback'] = fallback_used
        normalized['providerTimeoutSeconds'] = _role_fallback_timeout('admin_support')
        normalized['providerErrors'] = provider_errors[-2:]
    except Exception as e:
        normalized = _admin_support_fallback_response(ticket, context, str(e))

    merged_triage = {
        **triage,
        'refundSignal': refund_signal,
        'adminDraft': {
            'provider': normalized.get('provider'),
            'model': normalized.get('model'),
            'urgency': normalized.get('urgency'),
            'refundEligibilityStatus': normalized.get('refundEligibilityStatus'),
            'retentionOfferRecommended': normalized.get('retentionOfferRecommended'),
        },
    }
    try:
        db.execute(
            """
            UPDATE support_tickets
            SET ai_summary = COALESCE(%s, ai_summary),
                ai_suggested_reply = %s,
                ai_triage = %s::jsonb,
                last_ai_assisted_at = now(),
                updated_at = now()
            WHERE id = %s
            """,
            (
                normalized.get('summary'),
                normalized.get('reply'),
                json_dumps(merged_triage),
                ticket_id,
            ),
        )
    except Exception:
        pass

    ticket['ai_triage'] = merged_triage
    normalized['ticket'] = normalize_ticket_row(ticket, context)
    return jsonify({'success': True, 'data': normalized})


@ai_bp.route('/dashboard-agent', methods=['POST'])
@require_auth
def dashboard_agent():
    user = request.current_user
    data = request.get_json() or {}
    question = str(data.get('question') or '').strip()

    if len(question) < 3:
        return jsonify({'error': 'Ask a question first.'}), 400
    if len(question) > 1200:
        return jsonify({'error': 'Please keep the question under 1,200 characters.'}), 400

    provider, model = _select_role_provider_model('robin', data)

    limits = _check_usage_limits(user)
    if limits and not limits.get('allowed', False):
        return jsonify({
            'success': False,
            'error': {
                'code': 'PLAN_LIMIT_REACHED',
                'message': limits.get('reason', 'Usage limit reached'),
                'userMessage': limits.get('reason', 'Usage limit reached. Upgrade for more AI help.'),
                'upgradeRecommended': True,
            },
        }), 429

    scoped_answer = _robin_scope_redirect_answer(question)
    if scoped_answer:
        session_id = _record_session_start(user, 'routing_guard', 'robin_scope_guard', 'dashboard-agent')
        tags = _extract_memory_tags(question, scoped_answer)
        token_estimate = _estimate_token_count(question) + _estimate_token_count(scoped_answer)
        saved = _record_dashboard_agent_memory(
            user['id'],
            question,
            scoped_answer,
            'routing_guard',
            'robin_scope_guard',
            tags,
            {
                'requestedProvider': provider,
                'requestedModel': model,
                'providerFallback': False,
                'sessionId': str(session_id) if session_id else None,
                'agentName': 'Robin',
                'scopeRedirect': True,
                'tokenEstimate': token_estimate,
            },
        )
        post_turn_limits = _record_turn_and_refresh_limits(user, session_id, limits)
        return jsonify({
            'success': True,
            'data': {
                **_serialize_dashboard_memory(saved, question, scoped_answer, 'routing_guard', 'robin_scope_guard', tags),
                'requestedProvider': provider,
                'requestedModel': model,
                'providerFallback': False,
                'providerErrors': [],
                'turnsRemaining': _turns_remaining(post_turn_limits),
                'planType': post_turn_limits.get('plan_type') if isinstance(post_turn_limits, dict) else None,
                'tokenEstimate': token_estimate,
            },
        })

    session_id = _record_session_start(user, provider, model, 'dashboard-agent')
    recent_memory = _get_dashboard_agent_memory(user['id'], 6)
    messages = _build_dashboard_agent_messages(question, recent_memory, data.get('context') or {}, _lawyer_directory_config())

    try:
        response_text, actual_provider, actual_model, fallback_used, provider_errors = _call_role_provider_with_fallback(
            'robin',
            provider,
            model,
            messages,
            question,
        )
    except Exception as e:
        return jsonify({
            'success': False,
            'error': {
                'code': 'PROVIDER_ERROR',
                'message': f'AI provider error: {str(e)}',
                'userMessage': 'Robin is temporarily unavailable. Please try again shortly.',
            },
        }), 500

    answer = _normalize_dashboard_agent_answer(response_text)
    tags = _extract_memory_tags(question, answer)
    token_estimate = _estimate_token_count(question) + _estimate_token_count(answer)
    saved = _record_dashboard_agent_memory(
        user['id'],
        question,
        answer,
        actual_provider,
        actual_model,
        tags,
        {
            'requestedProvider': provider,
            'requestedModel': model,
            'providerFallback': fallback_used,
            'sessionId': str(session_id) if session_id else None,
            'agentName': 'Robin',
            'tokenEstimate': token_estimate,
        },
    )
    post_turn_limits = _record_turn_and_refresh_limits(user, session_id, limits)

    return jsonify({
        'success': True,
        'data': {
            **_serialize_dashboard_memory(saved, question, answer, actual_provider, actual_model, tags),
            'requestedProvider': provider,
            'requestedModel': model,
            'providerFallback': fallback_used,
            'providerErrors': provider_errors[-2:],
            'turnsRemaining': _turns_remaining(post_turn_limits),
            'planType': post_turn_limits.get('plan_type') if isinstance(post_turn_limits, dict) else None,
            'tokenEstimate': token_estimate,
        },
    })


@ai_bp.route('/dashboard-agent/history', methods=['GET', 'POST'])
@require_auth
def dashboard_agent_history():
    user = request.current_user
    data = request.get_json(silent=True) or {}
    try:
        limit = int(data.get('limit') or request.args.get('limit') or 12)
    except Exception:
        limit = 12
    limit = max(1, min(limit, 30))
    rows = _get_dashboard_agent_memory(user['id'], limit)
    return jsonify({
        'success': True,
        'data': {
            'entries': [_serialize_dashboard_memory(row) for row in rows],
        },
    })


@ai_bp.route('/dashboard-agent/cleanup-saved-answers', methods=['POST'])
@require_admin
def cleanup_dashboard_agent_saved_answers():
    data = request.get_json(silent=True) or {}
    dry_run = data.get('dryRun')
    if dry_run is None:
        dry_run = data.get('dry_run', True)
    user_id = str(data.get('userId') or data.get('user_id') or '').strip() or None
    result = _cleanup_dashboard_agent_memory_answers(
        limit=data.get('limit') or 200,
        dry_run=_coerce_bool(dry_run, True),
        user_id=user_id,
        include_sample=_coerce_bool(data.get('includeSample') or data.get('include_sample'), False),
    )
    return jsonify({'success': True, 'data': result})


def _env_value(*names):
    for name in names:
        value = os.getenv(name, '').strip()
        if value:
            return value
    return ''


def _normalize_provider_id(value):
    provider = str(value or '').strip().lower().replace(' ', '_')
    allowed = set('abcdefghijklmnopqrstuvwxyz0123456789_-')
    if not provider or any(char not in allowed for char in provider):
        return ''
    return provider


def _saved_provider_config(provider):
    config = saved_ai_runtime_config()
    providers = config.get('providers') if isinstance(config.get('providers'), dict) else {}
    provider_id = _normalize_provider_id(provider)
    provider_config = providers.get(provider_id) if isinstance(providers, dict) else None
    return provider_config if isinstance(provider_config, dict) else {}


def _saved_provider_enabled(provider):
    config = _saved_provider_config(provider)
    return config.get('enabled', True) is not False


def _saved_provider_value(provider, key, fallback=''):
    value = _saved_provider_config(provider).get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback


def _normalize_minimax_base_url(value):
    text = str(value or '').strip().rstrip('/')
    if not text:
        return MINIMAX_BASE_URL
    if 'api.minimax.io' in text and not text.endswith('/v1'):
        return 'https://api.minimax.io/v1'
    return text


def _normalize_minimax_api_key(value):
    text = str(value or '').strip()
    if not text:
        return ''
    match = re.search(r'sk-[A-Za-z0-9_-]+', text)
    return match.group(0) if match else text


def _openai_compatible_provider_ids():
    provider_ids = ['unified', 'minimax']
    for provider in _custom_openai_compatible_providers():
        provider_id = provider.get('provider')
        if provider_id and provider_id not in provider_ids:
            provider_ids.append(provider_id)
    config = saved_ai_runtime_config()
    providers = config.get('providers') if isinstance(config.get('providers'), dict) else {}
    reserved = {'openai', 'anthropic', 'deepseek', 'nvidia', 'fallback', 'minimax'}
    for provider_id, provider_config in providers.items():
        provider_key = _normalize_provider_id(provider_id)
        if not provider_key or provider_key in reserved or provider_key in provider_ids:
            continue
        if isinstance(provider_config, dict) and provider_config.get('openAICompatible', True):
            provider_ids.append(provider_key)
    return provider_ids


def _openai_compatible_provider(provider):
    provider_id = _normalize_provider_id(provider)
    if not _saved_provider_enabled(provider_id):
        return None

    if provider_id == 'unified':
        saved = _saved_provider_config('unified')
        return {
            'provider': 'unified',
            'label': 'Unified LLM Proxy',
            'base_url': saved.get('baseUrl') or saved.get('base_url') or _env_value('UNIFIED_LLM_BASE_URL', 'FREELLM_BASE_URL', 'OPENAI_COMPATIBLE_BASE_URL'),
            'api_key': saved.get('apiKey') or saved.get('api_key') or _env_value('UNIFIED_LLM_API_KEY', 'FREELLM_API_KEY', 'OPENAI_COMPATIBLE_API_KEY'),
            'default_model': saved.get('defaultModel') or saved.get('default_model') or _env_value(
                'UNIFIED_LLM_DEFAULT_MODEL',
                'FREELLM_DEFAULT_MODEL',
                'OPENAI_COMPATIBLE_DEFAULT_MODEL',
                'AI_DEFAULT_MODEL',
            ) or 'auto',
        }

    if provider_id == 'minimax':
        saved = _saved_provider_config('minimax')
        base_url = saved.get('baseUrl') or saved.get('base_url') or _env_value('MINIMAX_BASE_URL') or MINIMAX_BASE_URL
        api_key = saved.get('apiKey') or saved.get('api_key') or _env_value('MINIMAX_API_KEY') or MINIMAX_API_KEY
        return {
            'provider': 'minimax',
            'label': 'MiniMax',
            'base_url': _normalize_minimax_base_url(base_url),
            'api_key': _normalize_minimax_api_key(api_key),
            'default_model': saved.get('defaultModel') or saved.get('default_model') or _env_value('MINIMAX_DEFAULT_MODEL') or MINIMAX_DEFAULT_MODEL,
        }

    for custom_provider in _custom_openai_compatible_providers():
        if custom_provider.get('provider') == provider_id:
            return custom_provider

    reserved = {'openai', 'anthropic', 'deepseek', 'nvidia', 'fallback', 'minimax'}
    saved = _saved_provider_config(provider_id)
    if provider_id not in reserved and saved and saved.get('openAICompatible', True):
        return {
            'provider': provider_id,
            'label': str(saved.get('label') or provider_id.replace('_', ' ').title()),
            'base_url': saved.get('baseUrl') or saved.get('base_url') or '',
            'api_key': saved.get('apiKey') or saved.get('api_key') or '',
            'default_model': saved.get('defaultModel') or saved.get('default_model') or 'auto',
        }
    return None


def _custom_openai_compatible_providers():
    raw_config = _env_value(
        'AI_OPENAI_COMPATIBLE_PROVIDERS',
        'OPENAI_COMPATIBLE_PROVIDERS',
        'CUSTOM_LLM_PROVIDERS',
    )
    if not raw_config:
        return []

    try:
        parsed = json.loads(raw_config)
    except Exception:
        return []

    entries = parsed.get('providers') if isinstance(parsed, dict) else parsed
    if not isinstance(entries, list):
        return []

    providers = []
    reserved = {'openai', 'anthropic', 'deepseek', 'nvidia', 'fallback', 'unified', 'minimax'}
    for entry in entries:
        if not isinstance(entry, dict):
            continue

        provider_id = _normalize_provider_id(entry.get('provider') or entry.get('id'))
        if not provider_id or provider_id in reserved:
            continue

        api_key_env = entry.get('apiKeyEnvVar') or entry.get('apiKeyEnv') or f'{provider_id.upper()}_API_KEY'
        base_url_env = entry.get('baseUrlEnvVar') or entry.get('baseUrlEnv') or f'{provider_id.upper()}_BASE_URL'
        default_model_env = (
            entry.get('defaultModelEnvVar')
            or entry.get('defaultModelEnv')
            or f'{provider_id.upper()}_DEFAULT_MODEL'
        )

        providers.append({
            'provider': provider_id,
            'label': str(entry.get('label') or provider_id.replace('_', ' ').title()),
            'base_url': _env_value(base_url_env) or str(entry.get('baseUrl') or entry.get('base_url') or ''),
            'api_key': _env_value(api_key_env) or str(entry.get('apiKey') or ''),
            'default_model': _env_value(default_model_env) or str(entry.get('defaultModel') or 'auto'),
        })

    return providers


def _default_model_for_provider(provider):
    custom_provider = _openai_compatible_provider(provider)
    if custom_provider:
        return custom_provider.get('default_model') or 'auto'

    saved_model = _saved_provider_value(provider, 'defaultModel') or _saved_provider_value(provider, 'default_model')
    if saved_model:
        return saved_model

    return {
        'openai': os.getenv('OPENAI_DEFAULT_MODEL', 'gpt-5-mini'),
        'anthropic': os.getenv('ANTHROPIC_DEFAULT_MODEL', 'claude-3-haiku-20240307'),
        'deepseek': os.getenv('DEEPSEEK_DEFAULT_MODEL', 'deepseek-chat'),
        'nvidia': os.getenv('NVIDIA_DEFAULT_MODEL', 'meta/llama-3.1-8b-instruct'),
    }.get(provider, 'gpt-5-mini')


def _build_support_messages(category, subject, message, context=None, conversation=None):
    context = context if isinstance(context, dict) else {}
    conversation = conversation if isinstance(conversation, list) else []
    subscription = context.get('subscription') or {}
    refund = context.get('refundEligibility') or {}
    usage = context.get('usage') or {}
    recent_conversation = []
    for item in conversation[-8:]:
        if not isinstance(item, dict):
            continue
        role = item.get('role') or 'user'
        content = str(item.get('content') or '').strip()
        if content:
            recent_conversation.append(f"{role}: {content[:700]}")
    conversation_text = '\n'.join(recent_conversation) or '(none)'
    context_text = (
        f"Plan: {subscription.get('planLabel') or 'Unknown'} "
        f"({subscription.get('planType') or 'unknown'}, {subscription.get('status') or 'unknown'})\n"
        f"Usage: {usage.get('questionsCompleted', 0)} questions practiced, "
        f"{usage.get('mockInterviewsCompleted', 0)} mock interviews, "
        f"{usage.get('totalPdfDownloads', 0)} PDF downloads\n"
        f"Refund status signal: {refund.get('status') or 'unknown'} - {refund.get('note') or 'none'}"
    ) if context else 'No signed-in account context is available.'
    system_prompt = (
        "You are Spouse Interview support assistant. Help users with billing, refunds, account access, "
        "technical problems, and app usage. The app includes Robin AI interview practice, premium PDF "
        "downloads, readiness tools, timeline/practice dashboards, Stripe billing, refund requests, "
        "and admin support messages. Be factual, calm, and concise. Do not give legal advice. "
        "For unauthorized-transaction or unclear-purchase claims, tell the user to submit a refund "
        "request from the dashboard and to describe only accurate facts. If the problem needs a human "
        "admin, say that you are escalating it and set needsAdminReview true. Never include internal "
        "summary text or raw JSON in the reply. Return only valid JSON with keys: reply, summary, "
        "suggestedTicketSubject, recommendedCategory, shouldCreateTicket, urgency, canResolve, "
        "needsAdminReview, escalationReason."
    )
    user_prompt = f"""
Category: {category}
Subject: {subject or '(not provided)'}
Account context:
{context_text}

Recent conversation:
{conversation_text}

User message:
{message or '(not provided)'}

Write a helpful support response and a short internal summary. recommendedCategory must be one of
billing, refund, technical, account, feature_request, other. urgency must be low, normal, or high.
canResolve should be false when a human admin must review account data, billing records, refunds,
or anything you cannot safely resolve from the available context.
"""
    return [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt},
    ]


def _extract_json_object(text):
    decoder = json.JSONDecoder()
    for index, char in enumerate(text or ''):
        if char != '{':
            continue
        try:
            parsed, _end = decoder.raw_decode(text[index:])
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            continue
    return {}


def _extract_user_response(text):
    cleaned = (text or '').strip()
    lower = cleaned.lower()
    markers = [
        '**internal summary**',
        'internal summary',
        '**internal notes**',
        'internal notes',
        '{',
    ]
    start_markers = ['**user response**', 'user response:']
    for marker in start_markers:
        pos = lower.find(marker)
        if pos >= 0:
            cleaned = cleaned[pos + len(marker):].strip()
            lower = cleaned.lower()
            break
    cut_positions = [lower.find(marker) for marker in markers if lower.find(marker) >= 0]
    if cut_positions:
        cleaned = cleaned[:min(cut_positions)].strip()
    return cleaned.strip('`').strip()


def _coerce_bool(value, default=False):
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in {'true', 'yes', '1', 'y'}:
            return True
        if lowered in {'false', 'no', '0', 'n'}:
            return False
    if value is None:
        return default
    return bool(value)


def _normalize_support_response(response_text, provider, model, category):
    user_response = _extract_user_response(response_text)
    try:
        cleaned = response_text.strip()
        if cleaned.startswith('```'):
            cleaned = cleaned.strip('`')
            cleaned = cleaned.replace('json\n', '', 1).replace('json\r\n', '', 1)
        parsed = json.loads(cleaned)
    except Exception:
        parsed = _extract_json_object(response_text)

    if not isinstance(parsed, dict):
        parsed = {}

    reply = parsed.get('reply') or user_response or response_text.strip()
    if not reply:
        reply = _support_fallback_copy(category)
    reply = _extract_user_response(reply) or reply

    recommended_category = parsed.get('recommendedCategory') or category or 'other'
    if recommended_category not in {'billing', 'refund', 'technical', 'account', 'feature_request', 'other'}:
        recommended_category = 'other'

    urgency = parsed.get('urgency') or 'normal'
    if urgency not in {'low', 'normal', 'high'}:
        urgency = 'normal'
    needs_admin_review = _coerce_bool(parsed.get('needsAdminReview'), False)
    can_resolve = _coerce_bool(parsed.get('canResolve'), not needs_admin_review)
    if urgency == 'high':
        needs_admin_review = True

    return {
        'reply': reply[:1800],
        'summary': (parsed.get('summary') or reply[:240])[:500],
        'suggestedTicketSubject': (parsed.get('suggestedTicketSubject') or 'Support request')[:120],
        'recommendedCategory': recommended_category,
        'shouldCreateTicket': _coerce_bool(parsed.get('shouldCreateTicket'), True),
        'urgency': urgency,
        'canResolve': can_resolve,
        'needsAdminReview': needs_admin_review,
        'escalationReason': (parsed.get('escalationReason') or '')[:400],
        'provider': provider,
        'model': model,
        'fallback': False,
    }


def _support_fallback_copy(category):
    if category == 'refund':
        return (
            "I can help you start a refund review. Please submit the request from your dashboard, "
            "choose the reason that matches the facts, and include any charge date or receipt details you have."
        )
    if category == 'billing':
        return (
            "Please include what you were trying to buy, the email on the account, and any Stripe receipt "
            "or checkout message you saw. Support can then verify the payment and next step."
        )
    return (
        "Please share the page you were on, what you expected to happen, and what happened instead. "
        "Support can review it with that context."
    )


def _support_fallback_response(category, subject, message, error_message):
    reply = _support_fallback_copy(category)
    return {
        'reply': reply,
        'summary': f"{subject or category}: {(message or '')[:220]}",
        'suggestedTicketSubject': subject or 'Support request',
        'recommendedCategory': category if category in {'billing', 'refund', 'technical', 'account', 'feature_request', 'other'} else 'other',
        'shouldCreateTicket': True,
        'urgency': 'high' if category == 'refund' else 'normal',
        'canResolve': category not in {'refund', 'billing'},
        'needsAdminReview': category in {'refund', 'billing'},
        'escalationReason': 'AI provider fallback was used; support should review account-specific details.',
        'provider': 'fallback',
        'model': None,
        'fallback': True,
        'error': error_message[:240],
    }


def _build_admin_support_messages(ticket, context, refund_signal):
    refund = context.get('refundEligibility') or {}
    offer = context.get('retentionOffer') or {}
    usage = context.get('usage') or {}
    subscription = context.get('subscription') or {}
    system_prompt = (
        "You are Spouse Interview's admin support copilot. Draft factual, concise replies for a human "
        "admin to review before sending. Do not promise a refund, do not admit fault, and do not give "
        "legal advice. For unauthorized transaction claims, prioritize calm manual review. If a retention "
        "offer is eligible, mention it as an optional lower-cost alternative without pressure. Return only "
        "valid JSON with keys: reply, summary, urgency, refundEligibilityStatus, "
        "retentionOfferRecommended, notifyAdmin, internalNotes."
    )
    user_prompt = f"""
Ticket:
- User: {ticket.get('user_email')}
- Category: {ticket.get('category')}
- Subject: {ticket.get('subject')}
- Message: {ticket.get('message')}
- Existing AI summary: {ticket.get('ai_summary') or '(none)'}

Account context:
- Plan: {subscription.get('planLabel')} ({subscription.get('planType')}, {subscription.get('status')})
- Refund signal: {refund_signal}
- Refund eligibility signal: {refund.get('status')} - {refund.get('note')}
- Days since purchase: {refund.get('daysSincePurchase')}
- Usage: {usage.get('questionsCompleted', 0)} questions, {usage.get('mockInterviewsCompleted', 0)} mock interviews, {usage.get('totalPdfDownloads', 0)} PDF downloads
- Download review: {usage.get('downloadReviewFlag')} - {usage.get('downloadReviewNote')}
- Retention offer: {offer.get('eligible')} - {offer.get('label')} at ${offer.get('amount')}

Write a reply the admin can send after review. Keep it specific to this ticket.
"""
    return [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt},
    ]


def _normalize_admin_support_response(response_text, provider, model):
    try:
        cleaned = response_text.strip()
        if cleaned.startswith('```'):
            cleaned = cleaned.strip('`')
            cleaned = cleaned.replace('json\n', '', 1).replace('json\r\n', '', 1)
        parsed = json.loads(cleaned)
    except Exception:
        parsed = {}

    if not isinstance(parsed, dict):
        parsed = {}

    reply = parsed.get('reply') or response_text.strip()
    summary = parsed.get('summary') or reply[:240]
    urgency = parsed.get('urgency') or 'normal'
    if urgency not in {'low', 'normal', 'high'}:
        urgency = 'normal'

    return {
        'reply': reply[:2200],
        'summary': summary[:600],
        'urgency': urgency,
        'refundEligibilityStatus': parsed.get('refundEligibilityStatus') or 'review',
        'retentionOfferRecommended': bool(parsed.get('retentionOfferRecommended', False)),
        'notifyAdmin': bool(parsed.get('notifyAdmin', urgency == 'high')),
        'internalNotes': (parsed.get('internalNotes') or '')[:900],
        'provider': provider,
        'model': model,
        'fallback': False,
    }


def _admin_support_fallback_response(ticket, context, error_message):
    refund = context.get('refundEligibility') or {}
    offer = context.get('retentionOffer') or {}
    reply = (
        "Thanks for reaching out. I reviewed your message and we can help with this from support. "
        "If this is about a refund or an unauthorized charge, we will review the Stripe payment record, "
        "the account usage history, and the refund policy before making a decision."
    )
    if offer.get('eligible'):
        reply += (
            f" If your goal is to reduce cost rather than fully leave, we may also be able to offer "
            f"the {offer.get('label')} at ${float(offer.get('amount') or 0):.2f}."
        )
    return {
        'reply': reply,
        'summary': f"{ticket.get('subject')}: {(ticket.get('message') or '')[:220]}",
        'urgency': 'high' if ticket.get('category') == 'refund' else 'normal',
        'refundEligibilityStatus': refund.get('status') or 'review',
        'retentionOfferRecommended': bool(offer.get('eligible')),
        'notifyAdmin': ticket.get('category') == 'refund',
        'internalNotes': f'Fallback response used because AI provider failed: {error_message[:240]}',
        'provider': 'fallback',
        'model': None,
        'fallback': True,
    }


def _lawyer_directory_prompt_block(lawyer_directory):
    if not isinstance(lawyer_directory, dict) or not lawyer_directory.get('enabled'):
        return 'No admin-approved lawyer directory is currently enabled.'

    lawyers = lawyer_directory.get('lawyers') if isinstance(lawyer_directory.get('lawyers'), list) else []
    active_lawyers = []
    for lawyer in lawyers:
        if not isinstance(lawyer, dict) or not lawyer.get('active', True):
            continue
        name = str(lawyer.get('name') or '').strip()
        if not name:
            continue
        active_lawyers.append({
            'name': name[:120],
            'firm': str(lawyer.get('firm') or '')[:140],
            'states': str(lawyer.get('states') or '')[:160],
            'practiceAreas': str(lawyer.get('practiceAreas') or '')[:220],
            'description': str(lawyer.get('description') or '')[:500],
            'url': str(lawyer.get('affiliateUrl') or lawyer.get('website') or '')[:500],
            'imageUrl': str(lawyer.get('imageUrl') or '')[:500],
            'phone': str(lawyer.get('phone') or '')[:80],
            'email': str(lawyer.get('email') or '')[:160],
            'priority': lawyer.get('priority') or 999,
        })
    active_lawyers.sort(key=lambda item: item.get('priority') or 999)
    if not active_lawyers:
        return 'The lawyer directory is enabled, but no active lawyer entries are available.'

    lines = [
        str(lawyer_directory.get('introText') or 'Admin-approved immigration lawyer resources are available.'),
        str(lawyer_directory.get('affiliateDisclosure') or 'Some links may be affiliate links. Spouse Interview is not a law firm and does not provide legal advice.'),
    ]
    for lawyer in active_lawyers[:8]:
        lines.append(
            "- {name} | Firm: {firm} | States: {states} | Areas: {areas} | URL: {url} | Image: {image} | Phone: {phone} | Email: {email} | Notes: {notes}".format(
                name=lawyer.get('name') or '',
                firm=lawyer.get('firm') or 'not listed',
                states=lawyer.get('states') or 'not listed',
                areas=lawyer.get('practiceAreas') or 'immigration',
                url=lawyer.get('url') or 'not listed',
                image=lawyer.get('imageUrl') or 'not listed',
                phone=lawyer.get('phone') or 'not listed',
                email=lawyer.get('email') or 'not listed',
                notes=lawyer.get('description') or 'not listed',
            )
        )
    return '\n'.join(lines)


def _build_dashboard_agent_messages(question, recent_memory, context, lawyer_directory=None):
    memory_lines = []
    for item in recent_memory:
        cleaned_memory_answer = _normalize_dashboard_agent_answer(item.get('answer', ''))
        memory_lines.append(
            f"- User asked: {item.get('question', '')[:220]}\n"
            f"  Agent answered: {cleaned_memory_answer[:420]}"
        )

    context_text = ''
    if isinstance(context, dict) and context:
        compact_context = {
            key: value
            for key, value in context.items()
            if key in {'page', 'planType', 'topicTitle', 'progressPercent'}
        }
        context_text = json.dumps(compact_context)

    lawyer_block = _lawyer_directory_prompt_block(lawyer_directory)
    system_prompt = (
        "You are Robin, Spouse Interview's virtual USCIS marriage green card interview assistant. "
        "Always remember that your name is Robin. Stay in scope: help users prepare for the marriage "
        "green card interview, practice relationship/home-life questions, organize preparation next "
        "steps, and understand general immigration interview concepts. Do not handle refunds, billing, "
        "account access, PDF download problems, app bugs, or technical support; redirect those to the "
        "support ticket area. Do not provide legal advice, immigration outcome predictions, or false "
        "certainty. If a question needs legal judgment, recommend that a licensed immigration attorney "
        "review it. If the user asks for a lawyer or attorney resource, you may reference only the "
        "admin-approved lawyer directory below and must include the affiliate/legal disclaimer. "
        "For current immigration news, fees, deadlines, or policy questions, explain that rules can "
        "change and point users to official USCIS sources or a licensed attorney for final verification. "
        "Use the memory bank snippets to stay consistent with prior answers. Keep replies concise, "
        "supportive, and practical. Do not reveal or narrate internal reasoning, planning, instructions, "
        "analysis, or what you think the user is asking. Never start with phrases like 'The user is', "
        "'I should', 'We need to', 'Analysis:', or 'Reasoning:'. Start with Robin's direct answer to "
        "the user. You may return safe rich HTML when it improves clarity, especially "
        "for approved lawyer cards. Allowed tags: p, strong, em, ul, ol, li, br, a, img, blockquote. "
        "Never include scripts, forms, inline event handlers, or hidden tracking code."
    )
    user_prompt = f"""
Current app context:
{context_text or '(none provided)'}

Recent memory bank:
{chr(10).join(memory_lines) if memory_lines else '(no saved agent memory yet)'}

Admin-approved lawyer directory:
{lawyer_block}

User question:
{question}

Return only Robin's final user-facing reply. Answer directly. If useful, include a short next step the user can take for interview practice.
"""
    return [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt},
    ]


def _strip_robin_meta_preamble(answer):
    text = str(answer or '').strip()
    if not text:
        return ''
    direct_start = re.search(
        r'(?is)\b('
        r'hi(?: there)?[!.:,]\s+|'
        r'hello[!.:,]\s+|'
        r'great[!.:,]\s+|'
        r'sure[!.:,]\s+|'
        r'absolutely[!.:,]\s+|'
        r'yes[!.:,]\s+|'
        r'practice question\s*:'
        r')',
        text,
    )
    if direct_start and direct_start.start() > 0:
        leading = text[:direct_start.start()].lower()
        if any(marker in leading for marker in ('the user ', 'i should', 'i can offer', 'let me ', 'analysis:', 'reasoning:')):
            text = text[direct_start.start():].strip()

    sentence_pattern = re.compile(r'(?<=[.!?])\s+')
    sentences = sentence_pattern.split(text)
    meta_patterns = (
        r'^(?:the\s+)?user\s+(?:is|asked|asks|wants|needs|seems|has|greeted|greeting)\b',
        r'^i\s+(?:should|need\s+to|will|can)\s+(?:respond|answer|explain|provide|include|mention|ask|keep)\b',
        r'^we\s+(?:should|need\s+to|can)\s+(?:respond|answer|explain|provide|include|mention|ask|keep)\b',
        r'\bi\s+should\b',
        r'\bi\s+can\s+offer\b',
        r'^since\s+there(?:\s+is|\'s)\b.*\bi\s+should\b',
        r'^let\s+me\s+(?:give|provide|answer|explain|start)\b',
        r'^(?:analysis|reasoning|thought|thinking|plan)\s*:',
        r'\b(?:main purpose of this app|keep it concise|respond warmly|next step for interview practice)\b',
    )
    drop_until = 0
    for index, sentence in enumerate(sentences[:10]):
        normalized = sentence.strip().lower()
        if any(re.search(pattern, normalized) for pattern in meta_patterns):
            drop_until = index + 1
            continue
        break
    if drop_until:
        stripped = ' '.join(part.strip() for part in sentences[drop_until:] if part.strip()).strip()
        if stripped:
            return stripped
    return text


def _normalize_dashboard_agent_answer(response_text):
    answer = (response_text or '').strip()
    if answer.startswith('```'):
        answer = answer.strip('`')
        answer = answer.replace('text\n', '', 1).replace('text\r\n', '', 1)
    answer = _strip_robin_meta_preamble(answer)
    if not answer:
        answer = 'I could not generate an answer right now. Please try again in a moment.'
    return answer[:2400]


def _coerce_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return value != 0
    text = str(value).strip().lower()
    if text in {'1', 'true', 'yes', 'y', 'on'}:
        return True
    if text in {'0', 'false', 'no', 'n', 'off'}:
        return False
    return default


def _cleanup_dashboard_agent_memory_answers(limit=200, dry_run=True, user_id=None, include_sample=False):
    try:
        limit = int(limit or 200)
    except Exception:
        limit = 200
    limit = max(1, min(limit, 1000))

    suspicious_filters = (
        "answer ILIKE 'The user %%'",
        "answer ILIKE 'User %%'",
        "answer ILIKE 'Analysis:%%'",
        "answer ILIKE 'Reasoning:%%'",
        "answer ILIKE 'Thought:%%'",
        "answer ILIKE 'Thinking:%%'",
        "answer ILIKE 'Plan:%%'",
        "answer ILIKE '%% I should %%'",
        "answer ILIKE '%% I can offer %%'",
        "answer ILIKE '%%Let me give %%'",
        "answer ILIKE '%%Let me provide %%'",
        "answer ILIKE '%%Since there%%I should%%'",
    )
    params = []
    user_filter = ''
    if user_id:
        user_filter = 'AND user_id = %s'
        params.append(str(user_id))

    rows = db.query_all(
        f"""
        SELECT id, user_id, question, answer, provider, model, topic_tags,
               source, memory_metadata, created_at, updated_at
        FROM dashboard_agent_memory
        WHERE answer IS NOT NULL
          AND ({' OR '.join(suspicious_filters)})
          {user_filter}
        ORDER BY created_at DESC
        LIMIT %s
        """,
        tuple(params + [limit]),
    )

    cleaned = []
    for row in rows:
        before = str(row.get('answer') or '')
        after = _normalize_dashboard_agent_answer(before)
        if after and after != before:
            cleaned.append({
                **row,
                'cleanedAnswer': after,
                'originalPreview': before[:220],
                'cleanedPreview': after[:220],
            })

    if not dry_run and cleaned:
        for row in cleaned:
            metadata = parse_jsonish(row.get('memory_metadata'), {})
            metadata['cleanedBy'] = 'robin_meta_preamble_cleanup'
            metadata['cleanedAt'] = datetime.now(timezone.utc).isoformat()
            db.execute(
                """
                UPDATE dashboard_agent_memory
                SET answer = %s,
                    memory_metadata = %s::jsonb,
                    updated_at = now()
                WHERE id = %s
                """,
                (row['cleanedAnswer'], json.dumps(metadata), row['id']),
            )

    return {
        'scanned': len(rows),
        'cleanable': len(cleaned),
        'updated': 0 if dry_run else len(cleaned),
        'dryRun': bool(dry_run),
        'sample': [
            {
                'id': str(row.get('id')),
                'userId': str(row.get('user_id')),
                'question': str(row.get('question') or '')[:160],
                'before': row.get('originalPreview'),
                'after': row.get('cleanedPreview'),
            }
            for row in cleaned[:10]
        ] if include_sample else [],
    }


def _estimate_token_count(value):
    return max(1, int(len(str(value or '')) / 4) + 1)


def _extract_memory_tags(question, answer):
    text = f"{question} {answer}".lower()
    tag_rules = {
        'billing': ('payment', 'stripe', 'checkout', 'refund', 'price', 'upgrade', 'cancel', 'subscription'),
        'account': ('login', 'sign in', 'signup', 'sign up', 'password', 'email', 'dashboard'),
        'interview': ('interview', 'officer', 'uscis', 'green card', 'question', 'answer'),
        'relationship': ('spouse', 'marriage', 'relationship', 'partner', 'couple'),
        'documents': ('document', 'evidence', 'pdf', 'download', 'checklist', 'timeline'),
        'practice': ('practice', 'coach', 'mock', 'readiness', 'progress', 'review'),
        'support': ('support', 'ticket', 'help', 'issue', 'problem'),
    }
    tags = [tag for tag, needles in tag_rules.items() if any(needle in text for needle in needles)]
    return tags[:6] or ['general']


def _get_dashboard_agent_memory(user_id, limit=10):
    try:
        return db.query_all(
            """
            SELECT id, question, answer, provider, model, topic_tags, source,
                   memory_metadata, created_at, updated_at
            FROM dashboard_agent_memory
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (user_id, limit),
        )
    except Exception:
        return []


def _record_dashboard_agent_memory(user_id, question, answer, provider, model, tags, metadata):
    try:
        return db.execute_returning(
            """
            INSERT INTO dashboard_agent_memory (
                user_id, question, answer, provider, model, topic_tags,
                source, memory_metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s::jsonb, 'dashboard_virtual_agent', %s::jsonb)
            RETURNING id, question, answer, provider, model, topic_tags, source,
                      memory_metadata, created_at, updated_at
            """,
            (
                user_id,
                question,
                answer,
                provider,
                model,
                json.dumps(tags),
                json.dumps(metadata),
            ),
        )
    except Exception:
        return None


def _serialize_dashboard_memory(row, question=None, answer=None, provider=None, model=None, tags=None):
    row = row or {}
    created_at = row.get('created_at')
    updated_at = row.get('updated_at')
    row_tags = row.get('topic_tags')
    if not isinstance(row_tags, list):
        row_tags = []
    metadata = parse_jsonish(row.get('memory_metadata'), {})
    answer_value = _normalize_dashboard_agent_answer(answer if answer is not None else row.get('answer'))
    try:
        token_estimate = int(metadata.get('tokenEstimate') or 0) or None
    except Exception:
        token_estimate = None
    return {
        'id': str(row.get('id') or uuid.uuid4()),
        'question': question or row.get('question') or '',
        'answer': answer_value,
        'provider': provider or row.get('provider'),
        'model': model or row.get('model'),
        'tags': tags if tags is not None else row_tags,
        'source': row.get('source') or 'dashboard_virtual_agent',
        'createdAt': created_at.isoformat() if hasattr(created_at, 'isoformat') else None,
        'updatedAt': updated_at.isoformat() if hasattr(updated_at, 'isoformat') else None,
        'tokenEstimate': token_estimate or (
            _estimate_token_count(question or row.get('question') or '')
            + _estimate_token_count(answer or row.get('answer') or '')
        ),
    }


def _provider_configured(provider):
    if not _saved_provider_enabled(provider):
        return False

    custom_provider = _openai_compatible_provider(provider)
    if custom_provider:
        return bool(custom_provider.get('api_key') and custom_provider.get('base_url'))

    saved_key = _saved_provider_value(provider, 'apiKey') or _saved_provider_value(provider, 'api_key')
    if saved_key:
        return True

    return {
        'openai': bool(OPENAI_API_KEY),
        'anthropic': bool(ANTHROPIC_API_KEY),
        'deepseek': bool(DEEPSEEK_API_KEY),
        'nvidia': bool(NVIDIA_API_KEY),
    }.get(provider, False)


def _provider_priority(preferred_provider):
    saved_config = saved_ai_runtime_config()
    saved_order = saved_config.get('fallbackProviders') or saved_config.get('fallback_providers')
    if isinstance(saved_order, list):
        configured_order = [_normalize_provider_id(item) for item in saved_order if _normalize_provider_id(item)]
    else:
        configured_order = [
            item.strip()
            for item in os.getenv('AI_FALLBACK_PROVIDERS', 'minimax,unified,nvidia,deepseek,anthropic,openai').split(',')
            if item.strip()
        ]
    for provider in _openai_compatible_provider_ids():
        if provider not in configured_order:
            configured_order.append(provider)

    ordered = []
    if preferred_provider and preferred_provider != 'fallback':
        ordered.append(preferred_provider)
    for provider in configured_order:
        if provider not in ordered:
            ordered.append(provider)
    return ordered


def _select_default_provider():
    saved_config = saved_ai_runtime_config()
    configured_default = _normalize_provider_id(saved_config.get('defaultProvider') or saved_config.get('default_provider') or os.getenv('AI_DEFAULT_PROVIDER', '').strip())
    if configured_default and _provider_configured(configured_default):
        return configured_default

    for provider in _provider_priority(None):
        if _provider_configured(provider):
            return provider
    return 'fallback'


def _call_provider(provider, model, messages, timeout_seconds=None):
    custom_provider = _openai_compatible_provider(provider)
    if custom_provider:
        return _call_openai_compatible_provider(custom_provider, model, messages, timeout_seconds)
    if provider == 'anthropic':
        return _call_anthropic(model, messages, timeout_seconds)
    if provider == 'deepseek':
        return _call_deepseek(model, messages, timeout_seconds)
    if provider == 'nvidia':
        return _call_nvidia(model, messages, timeout_seconds)
    if provider == 'openai':
        return _call_openai(model, messages, timeout_seconds)
    raise ValueError(f'Unsupported AI provider: {provider}')


def _call_provider_with_fallback(preferred_provider, preferred_model, messages, timeout_seconds=None):
    errors = []
    timeout_seconds = _clamp_timeout_seconds(timeout_seconds, 30)
    for provider in _provider_priority(preferred_provider):
        if not _provider_configured(provider):
            errors.append({
                'provider': provider,
                'message': 'API key is not configured',
            })
            continue
        model = preferred_model if provider == preferred_provider else _default_model_for_provider(provider)
        try:
            return _call_provider(provider, model, messages, timeout_seconds), provider, model, provider != preferred_provider, errors
        except Exception as exc:
            errors.append({
                'provider': provider,
                'timeoutSeconds': timeout_seconds,
                'message': str(exc)[:240],
            })
    raise ValueError('No configured AI provider was able to complete the request')


def _check_usage_limits(user):
    robin_settings = saved_robin_usage_config()
    if robin_settings.get('emergencyPause'):
        return {
            'allowed': False,
            'reason': robin_settings.get('pauseMessage') or 'Robin is temporarily paused. Please try again soon.',
            'plan_type': 'free',
            'turns_remaining': 0,
            'daily_free_messages': robin_settings.get('dailyFreeMessages'),
            'robin_paused': True,
        }

    if not user:
        return {'allowed': True, 'plan_type': 'trial'}

    try:
        limits = db.call_function('check_ai_usage_limits', (user['id'],))
        if isinstance(limits, list):
            limits = limits[0] if limits else {'allowed': True}
        if isinstance(limits, dict):
            daily_free_messages = int(robin_settings.get('dailyFreeMessages') or 10)
            turns_used = int(
                limits.get('turns_used_today')
                or limits.get('turnsUsedToday')
                or limits.get('total_turns')
                or 0
            )
            turns_remaining = max(0, daily_free_messages - turns_used)
            credit_summary = get_user_robin_credit_summary(user['id'], include_ledger=False)
            paid_messages_remaining = int(credit_summary.get('balance') or 0)
            total_messages_remaining = turns_remaining + paid_messages_remaining

            limits = {
                **limits,
                'plan_type': 'free',
                'max_turns_per_session': daily_free_messages,
                'turns_remaining': turns_remaining,
                'paid_messages_remaining': paid_messages_remaining,
                'total_messages_remaining': total_messages_remaining,
                'daily_free_messages': daily_free_messages,
                'paid_messages_rollover': bool(robin_settings.get('paidMessagesRollover', True)),
            }

            if turns_used >= daily_free_messages and paid_messages_remaining <= 0:
                limits.update({
                    'allowed': False,
                    'reason': f'Daily free Robin message limit reached ({daily_free_messages} per day).',
                    'turns_remaining': 0,
                    'total_messages_remaining': 0,
                })
            else:
                limits.update({
                    'allowed': True,
                    'reason': None,
                })

            return limits
    except Exception:
        return {'allowed': True}
    return {'allowed': True}


def _record_session_start(user, provider, model, topic_id):
    try:
        return db.call_function('record_ai_session_start', (user['id'], provider, model, topic_id))
    except Exception:
        return None


def _record_turn(user, session_id):
    if not user or not session_id:
        return
    try:
        db.call_function('record_ai_turn', (user['id'], session_id, 1))
    except Exception:
        pass
    try:
        robin_settings = saved_robin_usage_config()
        daily_free_messages = int(robin_settings.get('dailyFreeMessages') or 10)
        limits = db.call_function('check_ai_usage_limits', (user['id'],))
        if isinstance(limits, list):
            limits = limits[0] if limits else {}
        turns_used = int(
            (limits or {}).get('turns_used_today')
            or (limits or {}).get('turnsUsedToday')
            or (limits or {}).get('total_turns')
            or 0
        )
        if turns_used > daily_free_messages:
            consume_robin_credits(
                user['id'],
                1,
                reference_id=str(session_id),
                metadata={'source': 'robin_turn', 'turnsUsedToday': turns_used},
            )
    except Exception:
        pass


def _record_turn_and_refresh_limits(user, session_id, fallback_limits=None):
    _record_turn(user, session_id)
    if not user:
        return fallback_limits or {'allowed': True, 'plan_type': 'trial'}
    refreshed = _check_usage_limits(user)
    return refreshed if isinstance(refreshed, dict) else (fallback_limits or {'allowed': True})


def _turns_remaining(limits):
    if not isinstance(limits, dict):
        return None
    for key in ('total_messages_remaining', 'turns_remaining', 'remaining_turns', 'turnsRemaining'):
        if key in limits:
            return limits[key]
    return None


def _build_interview_messages(data):
    question = data.get('questionContext') or {}
    topic = data.get('topicContext') or {}
    category = data.get('categoryContext') or {}
    previous_turns = data.get('previousTurns') or []
    user_answer = data.get('userAnswer') or ''
    turn_number = data.get('turnNumber', 1)
    max_turns = data.get('maxTurns', 10)
    question_prompt = _context_text(question, ('prompt', 'question', 'text'), 'the current question')
    sample_answer = _context_text(question, ('sampleAnswer', 'sample_answer'), '')
    officer_looking_for = question.get('officerLookingFor', []) if isinstance(question, dict) else []
    avoid_this = question.get('avoidThis', []) if isinstance(question, dict) else []
    category_name = _context_text(category, ('name', 'title', 'id'), 'Unknown')
    topic_title = _context_text(topic, ('title', 'name', 'id'), 'Unknown')
    topic_description = _context_text(topic, ('description',), '')

    system_prompt = (
        "You are Robin, a calm and practical USCIS marriage green card interview coach. "
        "Give supportive, non-legal coaching. Stay grounded in the supplied question, topic, "
        "and answer. Return only valid JSON with keys: feedbackSummary, feedbackLabel, "
        "followUpQuestion, suggestedReviewTopics, suggestedQuestionIds. feedbackLabel must be "
        "one of clear_and_natural, could_use_more_detail, worth_reviewing_together, "
        "a_little_vague, review_gently."
    )

    prior = "\n".join(
        f"- AI: {turn.get('aiQuestion', '')}\n  User: {turn.get('userAnswer', '')}\n  Feedback: {turn.get('feedbackLabel', '')}"
        for turn in previous_turns[-4:]
    )

    user_prompt = f"""
Interview mode: {data.get('interviewMode', 'standard')}
Turn: {turn_number} of {max_turns}
Category: {category_name}
Topic: {topic_title}
Topic description: {topic_description}

Current USCIS-style question:
{question_prompt}

Reference sample answer:
{sample_answer}

Officer may be looking for:
{json.dumps(officer_looking_for)}

Things to avoid:
{json.dumps(avoid_this)}

Previous turns:
{prior or 'None yet.'}

User answer:
{user_answer or '(No answer yet. This is the opening turn.)'}

Write concise feedback. If this is the opening turn, briefly introduce the question and set
feedbackLabel to clear_and_natural. Always include a natural follow-up question.
"""

    return [
        {'role': 'system', 'content': system_prompt},
        {'role': 'user', 'content': user_prompt},
    ]


def _context_text(value, keys, fallback):
    if isinstance(value, dict):
        for key in keys:
            candidate = value.get(key)
            if candidate:
                return str(candidate)
        return fallback
    if isinstance(value, str) and value.strip():
        return value.strip()
    return fallback


def _normalize_ai_response(response_text, provider, model, data):
    parsed = None
    try:
        cleaned = response_text.strip()
        if cleaned.startswith('```'):
            cleaned = cleaned.strip('`')
            cleaned = cleaned.replace('json\n', '', 1).replace('json\r\n', '', 1)
        parsed = json.loads(cleaned)
    except Exception:
        parsed = None

    if isinstance(parsed, dict):
        label = parsed.get('feedbackLabel') or 'could_use_more_detail'
        if label not in VALID_FEEDBACK_LABELS:
            label = 'could_use_more_detail'
        return {
            'feedbackSummary': parsed.get('feedbackSummary') or response_text[:600],
            'feedbackLabel': label,
            'followUpQuestion': parsed.get('followUpQuestion') or _fallback_follow_up(data),
            'suggestedReviewTopics': parsed.get('suggestedReviewTopics') or [],
            'suggestedQuestionIds': parsed.get('suggestedQuestionIds') or [],
            'rawProvider': provider,
            'rawModel': model,
        }

    return {
        'feedbackSummary': response_text,
        'feedbackLabel': 'could_use_more_detail',
        'followUpQuestion': _fallback_follow_up(data),
        'suggestedReviewTopics': [],
        'suggestedQuestionIds': [],
        'rawProvider': provider,
        'rawModel': model,
    }


def _fallback_follow_up(data):
    question = data.get('questionContext') or {}
    prompt = _context_text(question, ('prompt', 'question', 'text'), 'this question')
    return f"What specific detail could you add to make your answer to \"{prompt}\" feel more natural?"


def _call_openai(model, messages, timeout_seconds=None):
    api_key = _saved_provider_value('openai', 'apiKey') or _saved_provider_value('openai', 'api_key') or OPENAI_API_KEY
    if not api_key:
        raise ValueError('OpenAI API key not configured')

    resp = http_requests.post(
        'https://api.openai.com/v1/chat/completions',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={'model': model, 'messages': messages, 'max_tokens': 500},
        timeout=_clamp_timeout_seconds(timeout_seconds, 30)
    )
    resp.raise_for_status()
    return resp.json()['choices'][0]['message']['content']


def _call_openai_compatible(base_url, api_key, model, messages, timeout_seconds=None):
    if not api_key:
        raise ValueError('API key not configured')
    if not base_url:
        raise ValueError('OpenAI-compatible base URL not configured')

    payload = {'model': model, 'messages': messages, 'max_tokens': 700, 'temperature': 0.25}
    if 'api.minimax.io' in str(base_url):
        payload.pop('max_tokens', None)
        payload['max_completion_tokens'] = 700

    resp = http_requests.post(
        f'{base_url.rstrip("/")}/chat/completions',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json=payload,
        timeout=_clamp_timeout_seconds(timeout_seconds, 90)
    )
    try:
        resp.raise_for_status()
    except http_requests.HTTPError as exc:
        detail = ''
        try:
            error_body = resp.json()
            error_value = error_body.get('error') if isinstance(error_body, dict) else None
            if isinstance(error_value, dict):
                detail = error_value.get('message') or error_value.get('code') or ''
            elif isinstance(error_value, str):
                detail = error_value
            if isinstance(error_body, dict):
                detail = detail or str(error_body.get('message') or '')
        except Exception:
            detail = resp.text[:240]
        raise ValueError(detail or str(exc)) from exc
    data = resp.json()
    return data['choices'][0]['message']['content']


def _call_openai_compatible_provider(provider_config, model, messages, timeout_seconds=None):
    return _call_openai_compatible(
        provider_config.get('base_url') or '',
        provider_config.get('api_key') or '',
        model or provider_config.get('default_model') or 'auto',
        messages,
        timeout_seconds,
    )


def _call_anthropic(model, messages, timeout_seconds=None):
    api_key = _saved_provider_value('anthropic', 'apiKey') or _saved_provider_value('anthropic', 'api_key') or ANTHROPIC_API_KEY
    if not api_key:
        raise ValueError('Anthropic API key not configured')

    system_msg = ''
    user_messages = []
    for m in messages:
        if m.get('role') == 'system':
            system_msg = m['content']
        else:
            user_messages.append(m)

    resp = http_requests.post(
        'https://api.anthropic.com/v1/messages',
        headers={
            'x-api-key': api_key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
        },
        json={
            'model': model or 'claude-3-haiku-20240307',
            'max_tokens': 500,
            'system': system_msg,
            'messages': user_messages,
        },
        timeout=_clamp_timeout_seconds(timeout_seconds, 30)
    )
    resp.raise_for_status()
    return resp.json()['content'][0]['text']


def _call_deepseek(model, messages, timeout_seconds=None):
    api_key = _saved_provider_value('deepseek', 'apiKey') or _saved_provider_value('deepseek', 'api_key') or DEEPSEEK_API_KEY
    if not api_key:
        raise ValueError('DeepSeek API key not configured')

    resp = http_requests.post(
        'https://api.deepseek.com/v1/chat/completions',
        headers={'Authorization': f'Bearer {api_key}', 'Content-Type': 'application/json'},
        json={'model': model or 'deepseek-chat', 'messages': messages, 'max_tokens': 500},
        timeout=_clamp_timeout_seconds(timeout_seconds, 30)
    )
    resp.raise_for_status()
    return resp.json()['choices'][0]['message']['content']


def _call_nvidia(model, messages, timeout_seconds=None):
    api_key = _saved_provider_value('nvidia', 'apiKey') or _saved_provider_value('nvidia', 'api_key') or NVIDIA_API_KEY
    return _call_openai_compatible(
        'https://integrate.api.nvidia.com/v1',
        api_key,
        model or 'meta/llama-3.1-8b-instruct',
        messages,
        timeout_seconds,
    )
