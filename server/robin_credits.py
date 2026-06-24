import json
import uuid
from typing import Any

import db


def _json_default(value: Any) -> str:
    return json.dumps(value or {})


def _bounded_int(value: Any, default: int, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        parsed = default
    return max(minimum, min(maximum, parsed))


def _clean_text(value: Any, default: str, limit: int) -> str:
    text = ' '.join(str(value or default).split())
    return text[:limit] or default


def ensure_robin_credit_tables() -> None:
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS robin_credit_grants (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            source_type TEXT NOT NULL DEFAULT 'admin_grant',
            pack_id TEXT,
            label TEXT NOT NULL DEFAULT 'Robin credits',
            messages_granted INTEGER NOT NULL CHECK (messages_granted > 0),
            messages_used INTEGER NOT NULL DEFAULT 0 CHECK (messages_used >= 0),
            expires_at TIMESTAMPTZ,
            rollover BOOLEAN NOT NULL DEFAULT true,
            status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'voided')),
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    db.execute(
        """
        CREATE TABLE IF NOT EXISTS robin_credit_ledger (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            grant_id UUID REFERENCES robin_credit_grants(id) ON DELETE SET NULL,
            event_type TEXT NOT NULL CHECK (event_type IN ('grant', 'purchase', 'usage', 'adjustment', 'void')),
            messages_delta INTEGER NOT NULL,
            balance_after INTEGER NOT NULL DEFAULT 0,
            reference_id TEXT,
            metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
            created_by UUID REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    db.execute("CREATE INDEX IF NOT EXISTS idx_robin_credit_grants_user ON robin_credit_grants(user_id, created_at DESC)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_robin_credit_grants_active ON robin_credit_grants(user_id, status, expires_at)")
    db.execute("CREATE INDEX IF NOT EXISTS idx_robin_credit_ledger_user ON robin_credit_ledger(user_id, created_at DESC)")


def get_user_robin_credit_summary(user_id: str, include_ledger: bool = True) -> dict[str, Any]:
    ensure_robin_credit_tables()
    grants = db.query_all(
        """
        SELECT
            id::text AS id,
            user_id::text AS user_id,
            source_type,
            pack_id,
            label,
            messages_granted,
            messages_used,
            GREATEST(messages_granted - messages_used, 0) AS messages_remaining,
            expires_at::text AS expires_at,
            rollover,
            status,
            metadata,
            created_by::text AS created_by,
            created_at::text AS created_at,
            updated_at::text AS updated_at,
            (expires_at IS NOT NULL AND expires_at <= now()) AS is_expired
        FROM robin_credit_grants
        WHERE user_id = %s
        ORDER BY
            CASE WHEN status = 'active' AND (expires_at IS NULL OR expires_at > now()) THEN 0 ELSE 1 END,
            expires_at ASC NULLS LAST,
            created_at DESC
        LIMIT 50
        """,
        (user_id,),
    )

    active_grants = [
        grant for grant in grants
        if grant.get('status') == 'active' and not grant.get('is_expired') and int(grant.get('messages_remaining') or 0) > 0
    ]
    expired_grants = [
        grant for grant in grants
        if grant.get('status') == 'active' and grant.get('is_expired') and int(grant.get('messages_remaining') or 0) > 0
    ]

    ledger = []
    if include_ledger:
        ledger = db.query_all(
            """
            SELECT
                id::text AS id,
                grant_id::text AS grant_id,
                event_type,
                messages_delta,
                balance_after,
                reference_id,
                metadata,
                created_by::text AS created_by,
                created_at::text AS created_at
            FROM robin_credit_ledger
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 50
            """,
            (user_id,),
        )

    return {
        'balance': sum(int(grant.get('messages_remaining') or 0) for grant in active_grants),
        'activeGrantCount': len(active_grants),
        'expiredMessages': sum(int(grant.get('messages_remaining') or 0) for grant in expired_grants),
        'totalGranted': sum(int(grant.get('messages_granted') or 0) for grant in grants),
        'totalUsed': sum(int(grant.get('messages_used') or 0) for grant in grants),
        'grants': grants,
        'ledger': ledger,
    }


def grant_robin_credits(
    user_id: str,
    messages: Any,
    *,
    label: Any = 'Manual Robin credit grant',
    pack_id: Any = None,
    expiration_days: Any = 365,
    rollover: bool = True,
    source_type: str = 'admin_grant',
    created_by: str | None = None,
    metadata: dict[str, Any] | None = None,
    reference_id: str | None = None,
) -> dict[str, Any]:
    ensure_robin_credit_tables()
    messages_count = _bounded_int(messages, 25, 1, 100000)
    expiration_count = _bounded_int(expiration_days, 365, 1, 3650)
    source = source_type if source_type in {'admin_grant', 'purchase', 'adjustment'} else 'admin_grant'
    grant_id = str(uuid.uuid4())
    ledger_id = str(uuid.uuid4())
    clean_label = _clean_text(label, 'Manual Robin credit grant', 120)
    clean_pack_id = _clean_text(pack_id, '', 80) if pack_id else None
    clean_reference_id = _clean_text(reference_id, '', 160) if reference_id else clean_pack_id
    metadata_json = _json_default(metadata)

    if clean_reference_id:
        existing = db.query_one(
            """
            SELECT id
            FROM robin_credit_ledger
            WHERE user_id = %s
              AND reference_id = %s
              AND event_type IN ('grant', 'purchase')
            LIMIT 1
            """,
            (user_id, clean_reference_id),
        )
        if existing:
            return get_user_robin_credit_summary(user_id)

    db.execute(
        """
        INSERT INTO robin_credit_grants (
            id, user_id, source_type, pack_id, label, messages_granted,
            expires_at, rollover, metadata, created_by
        )
        VALUES (
            %s, %s, %s, %s, %s, %s,
            now() + (%s::integer * interval '1 day'), %s, %s::jsonb, %s
        )
        """,
        (
            grant_id,
            user_id,
            source,
            clean_pack_id,
            clean_label,
            messages_count,
            expiration_count,
            bool(rollover),
            metadata_json,
            created_by,
        ),
    )

    balance_after = get_user_robin_credit_summary(user_id, include_ledger=False)['balance']
    db.execute(
        """
        INSERT INTO robin_credit_ledger (
            id, user_id, grant_id, event_type, messages_delta,
            balance_after, reference_id, metadata, created_by
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
        """,
        (
            ledger_id,
            user_id,
            grant_id,
            'purchase' if source == 'purchase' else 'grant',
            messages_count,
            balance_after,
            clean_reference_id,
            metadata_json,
            created_by,
        ),
    )

    return get_user_robin_credit_summary(user_id)


def consume_robin_credits(
    user_id: str,
    amount: Any = 1,
    *,
    reference_id: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    ensure_robin_credit_tables()
    amount_count = _bounded_int(amount, 1, 1, 1000)
    metadata_json = _json_default(metadata)

    with db.get_db_cursor() as cur:
        cur.execute(
            """
            SELECT
                id,
                GREATEST(messages_granted - messages_used, 0) AS messages_remaining
            FROM robin_credit_grants
            WHERE user_id = %s
              AND status = 'active'
              AND (expires_at IS NULL OR expires_at > now())
              AND messages_used < messages_granted
            ORDER BY expires_at ASC NULLS LAST, created_at ASC
            FOR UPDATE
            """,
            (user_id,),
        )
        grants = [dict(row) for row in cur.fetchall()]
        available = sum(int(grant.get('messages_remaining') or 0) for grant in grants)
        if available < amount_count:
            return {'success': False, 'consumed': 0, 'balance': available}

        remaining_to_consume = amount_count
        balance_after = available
        consumed = 0

        for grant in grants:
            if remaining_to_consume <= 0:
                break
            take = min(remaining_to_consume, int(grant.get('messages_remaining') or 0))
            if take <= 0:
                continue

            cur.execute(
                """
                UPDATE robin_credit_grants
                SET messages_used = messages_used + %s,
                    updated_at = now()
                WHERE id = %s
                """,
                (take, grant['id']),
            )

            balance_after -= take
            consumed += take
            remaining_to_consume -= take
            cur.execute(
                """
                INSERT INTO robin_credit_ledger (
                    id, user_id, grant_id, event_type, messages_delta,
                    balance_after, reference_id, metadata
                )
                VALUES (%s, %s, %s, 'usage', %s, %s, %s, %s::jsonb)
                """,
                (
                    str(uuid.uuid4()),
                    user_id,
                    grant['id'],
                    -take,
                    balance_after,
                    reference_id,
                    metadata_json,
                ),
            )

        return {'success': consumed == amount_count, 'consumed': consumed, 'balance': balance_after}
