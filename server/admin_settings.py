import json
import os
import re
from typing import Any

import db


def _json_default(value: Any) -> str:
    return json.dumps(value or {})


def ensure_admin_settings_table() -> None:
    try:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS admin_settings (
                key TEXT PRIMARY KEY,
                value JSONB NOT NULL DEFAULT '{}'::jsonb,
                updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
    except Exception:
        pass


def get_admin_setting(key: str, default: Any = None) -> Any:
    ensure_admin_settings_table()
    try:
        row = db.query_one("SELECT value FROM admin_settings WHERE key = %s", (key,))
    except Exception:
        return default
    if not row:
        return default
    value = row.get('value')
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return default
    return value if value is not None else default


def save_admin_setting(key: str, value: Any, updated_by: str | None = None) -> Any:
    ensure_admin_settings_table()
    payload = _json_default(value)
    try:
        row = db.execute_returning(
            """
            INSERT INTO admin_settings (key, value, updated_by)
            VALUES (%s, %s::jsonb, %s)
            ON CONFLICT (key) DO UPDATE SET
                value = EXCLUDED.value,
                updated_by = EXCLUDED.updated_by,
                updated_at = now()
            RETURNING value
            """,
            (key, payload, updated_by),
        )
        saved = row.get('value') if row else value
        if isinstance(saved, str):
            return json.loads(saved)
        return saved
    except Exception:
        return value


def env_value(*names: str) -> str:
    for name in names:
        value = os.getenv(name, '').strip()
        if value:
            return value
    return ''


def normalize_provider_id(value: str | None) -> str:
    provider_id = str(value or '').strip().lower().replace(' ', '_')
    allowed = set('abcdefghijklmnopqrstuvwxyz0123456789_-')
    if not provider_id or any(char not in allowed for char in provider_id):
        return ''
    return provider_id


def saved_ai_runtime_config() -> dict[str, Any]:
    raw = get_admin_setting('ai_runtime_config', {}) or {}
    return raw if isinstance(raw, dict) else {}


def saved_welcome_message_config() -> dict[str, Any]:
    raw = get_admin_setting('welcome_messages', {}) or {}
    return raw if isinstance(raw, dict) else {}


AD_PLACEMENT_DEFAULTS = {
    'dashboard.inline': False,
    'pdf_library.inline': False,
    'practice_completion.pre_download': False,
    'robin.inline': False,
    'messages.inline': False,
}

PDF_DOWNLOAD_OFFER_SOURCES = {
    'topic_page': False,
    'practice_mode': False,
    'practice_completion': True,
    'direct_link': False,
    'seo_page': False,
    'pdf_library': False,
}

PDF_DOWNLOAD_OFFER_FREQUENCIES = {'always', 'once_per_session', 'once_per_day'}

ROBIN_PACK_DEFAULTS = [
    {
        'id': 'starter',
        'label': 'Starter Pack',
        'messages': 50,
        'priceCents': 500,
        'expirationDays': 365,
        'rollover': True,
        'active': True,
    },
    {
        'id': 'practice',
        'label': 'Practice Pack',
        'messages': 150,
        'priceCents': 1200,
        'expirationDays': 365,
        'rollover': True,
        'active': True,
    },
    {
        'id': 'intensive',
        'label': 'Interview Week Pack',
        'messages': 500,
        'priceCents': 3000,
        'expirationDays': 365,
        'rollover': True,
        'active': True,
    },
]


def _normalize_adsense_publisher_id(value: Any) -> str:
    publisher_id = str(value or '').strip()
    if not publisher_id:
        return ''
    if re.fullmatch(r'ca-pub-\d{8,32}', publisher_id):
        return publisher_id
    if re.fullmatch(r'pub-\d{8,32}', publisher_id):
        return f'ca-{publisher_id}'
    return ''


def _clean_ads_txt(value: Any) -> str:
    lines = []
    for line in str(value or '').replace('\r\n', '\n').replace('\r', '\n').split('\n'):
        cleaned = line.strip()
        if cleaned:
            lines.append(cleaned[:300])
    return '\n'.join(lines)[:4000]


def normalize_ad_settings(value: Any = None) -> dict[str, Any]:
    raw = value if isinstance(value, dict) else {}
    status = str(raw.get('status') or 'disabled').strip().lower()
    if status not in {'disabled', 'verification_only', 'active'}:
        status = 'disabled'

    publisher_id = _normalize_adsense_publisher_id(raw.get('adsensePublisherId') or raw.get('adsense_publisher_id'))
    placements = {**AD_PLACEMENT_DEFAULTS}
    raw_placements = raw.get('placements') if isinstance(raw.get('placements'), dict) else {}
    for key in placements:
        placements[key] = bool(raw_placements.get(key, placements[key]))

    ads_txt = _clean_ads_txt(raw.get('adsTxt') or raw.get('ads_txt'))
    if not ads_txt and publisher_id:
        ads_txt = f'google.com, {publisher_id.replace("ca-", "")}, DIRECT, f08c47fec0942fa0'

    return {
        'status': status,
        'adsensePublisherId': publisher_id,
        'adsenseSlotId': str(raw.get('adsenseSlotId') or raw.get('adsense_slot_id') or '').strip()[:80],
        'includeAdsenseMeta': bool(raw.get('includeAdsenseMeta', True)),
        'includeAdsenseScript': bool(raw.get('includeAdsenseScript', False)),
        'enableAdsTxt': bool(raw.get('enableAdsTxt', bool(publisher_id))),
        'adsTxt': ads_txt,
        'placements': placements,
    }


def saved_ad_settings_config() -> dict[str, Any]:
    raw = get_admin_setting('ad_settings', {}) or {}
    return normalize_ad_settings(raw)


def _clean_offer_url(value: Any) -> str:
    url = str(value or '').strip()
    if not url:
        return ''
    if url.startswith('/'):
        return url[:700]
    if re.fullmatch(r'https?://[^\s<>"\']{4,690}', url):
        return url[:700]
    return ''


def normalize_pdf_download_offer_settings(value: Any = None) -> dict[str, Any]:
    raw = value if isinstance(value, dict) else {}
    sources = {**PDF_DOWNLOAD_OFFER_SOURCES}
    raw_sources = raw.get('sources') if isinstance(raw.get('sources'), dict) else {}
    for key in sources:
        sources[key] = bool(raw_sources.get(key, sources[key]))

    frequency = str(raw.get('frequency') or 'once_per_session').strip()
    if frequency not in PDF_DOWNLOAD_OFFER_FREQUENCIES:
        frequency = 'once_per_session'

    return {
        'enabled': bool(raw.get('enabled', False)),
        'disclosureLabel': str(raw.get('disclosureLabel') or 'Sponsored Resource').strip()[:120],
        'title': str(raw.get('title') or 'Before you download').strip()[:160],
        'bodyHtml': str(raw.get('bodyHtml') or '').strip()[:6000],
        'ctaLabel': str(raw.get('ctaLabel') or 'Open sponsored resource').strip()[:80],
        'ctaUrl': _clean_offer_url(raw.get('ctaUrl')),
        'continueLabel': str(raw.get('continueLabel') or 'Continue to PDF').strip()[:80],
        'frequency': frequency,
        'sources': sources,
    }


def saved_pdf_download_offer_config() -> dict[str, Any]:
    raw = get_admin_setting('pdf_download_offer', {}) or {}
    return normalize_pdf_download_offer_settings(raw)


def _bounded_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _normalize_robin_pack(value: Any, fallback: dict[str, Any]) -> dict[str, Any]:
    raw = value if isinstance(value, dict) else {}
    pack_id = str(raw.get('id') or fallback.get('id') or '').strip().lower()
    pack_id = re.sub(r'[^a-z0-9_-]+', '-', pack_id).strip('-')[:48] or str(fallback.get('id') or 'pack')

    return {
        'id': pack_id,
        'label': str(raw.get('label') or fallback.get('label') or 'Message Pack').strip()[:80],
        'messages': _bounded_int(raw.get('messages'), int(fallback.get('messages') or 50), 1, 10000),
        'priceCents': _bounded_int(raw.get('priceCents'), int(fallback.get('priceCents') or 500), 0, 1000000),
        'expirationDays': _bounded_int(raw.get('expirationDays'), int(fallback.get('expirationDays') or 365), 1, 3650),
        'rollover': bool(raw.get('rollover', fallback.get('rollover', True))),
        'active': bool(raw.get('active', fallback.get('active', True))),
    }


def normalize_robin_usage_settings(value: Any = None) -> dict[str, Any]:
    raw = value if isinstance(value, dict) else {}
    default_packs_by_id = {pack['id']: pack for pack in ROBIN_PACK_DEFAULTS}
    incoming_packs = raw.get('paidPacks') if isinstance(raw.get('paidPacks'), list) else ROBIN_PACK_DEFAULTS

    packs = []
    for index, pack in enumerate(incoming_packs[:12]):
        fallback = default_packs_by_id.get(str((pack or {}).get('id') if isinstance(pack, dict) else ''), ROBIN_PACK_DEFAULTS[min(index, len(ROBIN_PACK_DEFAULTS) - 1)])
        packs.append(_normalize_robin_pack(pack, fallback))

    if not packs:
        packs = [_normalize_robin_pack(pack, pack) for pack in ROBIN_PACK_DEFAULTS]

    return {
        'dailyFreeMessages': _bounded_int(raw.get('dailyFreeMessages'), 10, 1, 200),
        'dailyResetTimezone': str(raw.get('dailyResetTimezone') or 'America/New_York').strip()[:80],
        'emergencyPause': bool(raw.get('emergencyPause', False)),
        'pauseMessage': str(raw.get('pauseMessage') or 'Robin is temporarily paused while we tune the free app experience. Please try again soon.').strip()[:500],
        'freeMessagesRollover': False,
        'paidMessagesRollover': bool(raw.get('paidMessagesRollover', True)),
        'paidCreditPacksEnabled': bool(raw.get('paidCreditPacksEnabled', False)),
        'creditPacksUnavailableMessage': str(
            raw.get('creditPacksUnavailableMessage')
            or 'Extra Robin message packs are not available yet. Daily free messages refresh automatically each day.'
        ).strip()[:500],
        'paidCreditExpirationDays': _bounded_int(raw.get('paidCreditExpirationDays'), 365, 1, 3650),
        'paidPacks': packs,
    }


def saved_robin_usage_config() -> dict[str, Any]:
    raw = get_admin_setting('robin_usage_settings', {}) or {}
    return normalize_robin_usage_settings(raw)
