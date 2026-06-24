"""
Legacy paid-app support compatibility helpers.

The free app no longer exposes support-ticket, refund, or retention workflows.
This module remains only so quarantined compatibility code can import the old
normalizers while the active app uses dashboard messages, broadcasts, sponsor
resources, and Robin credit support instead.
"""

import json
import os
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Optional

import db


ALLOWED_TICKET_CATEGORIES = {
    'billing',
    'refund',
    'technical',
    'account',
    'feature_request',
    'other',
}

REFUND_SIGNAL_TERMS = (
    'refund',
    'unauthorized',
    'did not authorize',
    'chargeback',
    'dispute',
    'charged',
    'payment',
    'billing',
)

CANCEL_SIGNAL_TERMS = (
    'cancel',
    'cancellation',
    'downgrade',
    'too expensive',
    'cannot afford',
    'refund',
)

PLAN_LABELS = {
    'trial': 'Free Trial',
    'monthly': 'Premium Monthly',
    'lifetime': 'Lifetime Access',
    'interviewPass': '90-Day Interview Pass',
}

PLAN_PRICES = {
    'monthly': 1999,
    'lifetime': 7999,
    'interviewPass': 3999,
}


def parse_jsonish(value: Any, fallback: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else (fallback or {})
        except json.JSONDecodeError:
            return fallback or {}
    return fallback or {}


def to_jsonable(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: to_jsonable(val) for key, val in value.items()}
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    return value


def json_dumps(value: Dict[str, Any]) -> str:
    return json.dumps(to_jsonable(value))


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def normalize_ticket_category(category: str) -> str:
    return category if category in ALLOWED_TICKET_CATEGORIES else 'other'


def text_has_any(text: str, terms: Iterable[str]) -> bool:
    haystack = (text or '').lower()
    return any(term in haystack for term in terms)


def has_refund_signal(
    category: str,
    subject: str = '',
    message: str = '',
    ai_triage: Optional[Dict[str, Any]] = None,
) -> bool:
    triage = ai_triage or {}
    combined = f'{subject}\n{message}'
    return (
        category == 'refund'
        or triage.get('recommendedCategory') == 'refund'
        or bool(triage.get('refundSignal'))
        or text_has_any(combined, REFUND_SIGNAL_TERMS)
    )


def has_cancel_signal(
    category: str,
    subject: str = '',
    message: str = '',
    ai_triage: Optional[Dict[str, Any]] = None,
) -> bool:
    triage = ai_triage or {}
    combined = f'{subject}\n{message}'
    return (
        category == 'refund'
        or bool(triage.get('cancelSignal'))
        or text_has_any(combined, CANCEL_SIGNAL_TERMS)
    )


def _coerce_datetime(value: Any) -> Optional[datetime]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return None
    return None


def _usage_counts(user_id: str) -> Dict[str, int]:
    questions_completed = 0
    mock_interviews_completed = 0
    try:
        progress = db.query_one(
            """
            SELECT
                COALESCE((SELECT questions_practiced FROM user_progress WHERE user_id = %s), 0)
                + COALESCE((
                    SELECT COUNT(*) FROM question_states
                    WHERE user_id = %s
                    AND COALESCE(comfort_status, 'not-seen') <> 'not-seen'
                ), 0) AS questions_completed
            """,
            (user_id, user_id),
        )
        questions_completed = int(progress.get('questions_completed') or 0) if progress else 0
    except Exception:
        questions_completed = 0

    try:
        sessions = db.query_one(
            """
            SELECT COUNT(*) AS mock_interviews_completed
            FROM ai_session_tracking
            WHERE user_id = %s AND COALESCE(turns_count, 0) >= 5
            """,
            (user_id,),
        )
        mock_interviews_completed = int(sessions.get('mock_interviews_completed') or 0) if sessions else 0
    except Exception:
        mock_interviews_completed = 0

    return {
        'questionsCompleted': questions_completed,
        'mockInterviewsCompleted': mock_interviews_completed,
    }


def _computed_refund_status(
    reason: str,
    days_since_purchase: Optional[int],
    questions_completed: int,
    mock_interviews_completed: int,
) -> Dict[str, Any]:
    if days_since_purchase is None:
        return {
            'status': 'no_paid_purchase',
            'note': 'No paid Stripe purchase was found for this account.',
        }
    if reason == 'unauthorized_transaction':
        return {
            'status': 'eligible',
            'note': 'Unauthorized transaction claim should receive priority manual review.',
        }
    if (
        days_since_purchase <= 7
        and questions_completed < 25
        and mock_interviews_completed <= 1
    ):
        return {
            'status': 'eligible',
            'note': 'Within the 7-day refund window with limited recorded usage.',
        }
    if (
        reason == 'unclear_purchase'
        and days_since_purchase <= 14
        and questions_completed < 25
        and mock_interviews_completed <= 1
    ):
        return {
            'status': 'eligible',
            'note': 'Unclear purchase claim is within the extended manual review window.',
        }
    return {
        'status': 'not_eligible',
        'note': 'Outside the standard refund window or usage limits; support should still review the facts.',
    }


def get_user_support_context(user_id: str, refund_reason: str = 'other') -> Dict[str, Any]:
    subscription = db.query_one(
        """
        SELECT user_id, plan_type, status, provider, provider_customer_id,
               provider_subscription_id, trial_ends_at, current_period_ends_at,
               interview_pass_ends_at, canceled_at, ends_at, metadata,
               created_at, updated_at
        FROM user_subscriptions
        WHERE user_id = %s
        """,
        (user_id,),
    )
    usage = _usage_counts(user_id)
    download_summary = db.query_one(
        """
        SELECT total_downloads, unique_pdfs_downloaded, review_flag, review_note,
               first_download_at, last_download_at
        FROM pdf_download_summaries
        WHERE user_id = %s
        """,
        (user_id,),
    ) or {
        'total_downloads': 0,
        'unique_pdfs_downloaded': 0,
        'review_flag': 'no_downloads',
        'review_note': 'No PDF download activity recorded for this user.',
        'first_download_at': None,
        'last_download_at': None,
    }
    latest_refund = db.query_one(
        """
        SELECT id, eligibility_status, reason, additional_comments, amount,
               currency, days_since_purchase, questions_completed,
               mock_interviews_completed, created_at
        FROM refund_requests
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (user_id,),
    )

    purchased_at = _coerce_datetime(subscription.get('created_at')) if subscription else None
    days_since_purchase = None
    if purchased_at:
        days_since_purchase = max(0, (datetime.now(timezone.utc) - purchased_at).days)

    if latest_refund:
        refund_status = {
            'status': latest_refund.get('eligibility_status'),
            'note': latest_refund.get('additional_comments') or 'Existing refund request is on file.',
        }
    else:
        refund_status = _computed_refund_status(
            refund_reason,
            days_since_purchase if subscription and subscription.get('plan_type') != 'trial' else None,
            usage['questionsCompleted'],
            usage['mockInterviewsCompleted'],
        )

    plan_type = subscription.get('plan_type') if subscription else 'trial'
    status = subscription.get('status') if subscription else 'trialing'
    retention_offer = build_retention_offer(plan_type, status)

    return to_jsonable({
        'subscription': {
            'planType': plan_type,
            'planLabel': PLAN_LABELS.get(plan_type, 'Unknown plan'),
            'status': status,
            'provider': subscription.get('provider') if subscription else None,
            'currentPeriodEndsAt': subscription.get('current_period_ends_at') if subscription else None,
            'canceledAt': subscription.get('canceled_at') if subscription else None,
            'endsAt': subscription.get('ends_at') if subscription else None,
        },
        'usage': {
            **usage,
            'totalPdfDownloads': int(download_summary.get('total_downloads') or 0),
            'uniquePdfsDownloaded': int(download_summary.get('unique_pdfs_downloaded') or 0),
            'downloadReviewFlag': download_summary.get('review_flag') or 'no_downloads',
            'downloadReviewNote': download_summary.get('review_note'),
        },
        'refundEligibility': {
            **refund_status,
            'latestRefundRequestId': str(latest_refund.get('id')) if latest_refund else None,
            'daysSincePurchase': latest_refund.get('days_since_purchase') if latest_refund else days_since_purchase,
            'questionsCompleted': latest_refund.get('questions_completed') if latest_refund else usage['questionsCompleted'],
            'mockInterviewsCompleted': latest_refund.get('mock_interviews_completed') if latest_refund else usage['mockInterviewsCompleted'],
            'downloadReviewFlag': download_summary.get('review_flag') or 'no_downloads',
        },
        'retentionOffer': retention_offer,
    })


def build_retention_offer(plan_type: Optional[str], status: Optional[str]) -> Dict[str, Any]:
    amount_cents = int(os.getenv('RETENTION_INTERVIEW_PASS_PRICE_CENTS', '1900') or '1900')
    eligible = (
        plan_type == 'monthly'
        and status in ('active', 'canceled', 'past_due', 'grace_period')
    )
    return {
        'eligible': eligible,
        'planType': 'interviewPass',
        'label': '90-Day Interview Pass Retention Offer',
        'amountCents': amount_cents,
        'amount': round(amount_cents / 100, 2),
        'currency': 'usd',
        'message': (
            'Offer a lower-cost 90-day interview pass before cancellation or refund.'
            if eligible
            else 'No retention offer is currently recommended for this plan.'
        ),
    }


def admin_recipients() -> List[Dict[str, str]]:
    recipients: Dict[str, Dict[str, str]] = {}
    env_value = (
        os.getenv('SUPPORT_ADMIN_EMAILS')
        or os.getenv('ADMIN_EMAILS')
        or os.getenv('SUPPORT_EMAIL')
        or ''
    )
    for email in [part.strip() for part in env_value.split(',') if part.strip()]:
        recipients[email.lower()] = {'email': email, 'userId': ''}

    try:
        rows = db.query_all(
            """
            SELECT u.id::text AS user_id, u.email
            FROM users u
            JOIN user_profiles p ON p.user_id = u.id
            WHERE p.role IN ('admin', 'superadmin')
              AND COALESCE(p.is_active, true) = true
            """
        )
        for row in rows:
            email = row.get('email')
            if email:
                recipients[email.lower()] = {'email': email, 'userId': str(row.get('user_id') or '')}
    except Exception:
        pass

    return list(recipients.values())


def notify_admins(title: str, message: str, metadata: Dict[str, Any], notification_type: str = 'support') -> int:
    count = 0
    for recipient in admin_recipients():
        user_id = recipient.get('userId')
        if not user_id:
            continue
        try:
            db.call_function('create_user_notification', (
                user_id,
                notification_type,
                title,
                message,
                None,
                json_dumps(metadata),
            ))
            count += 1
        except Exception:
            pass
    return count


def normalize_ticket_row(row: Dict[str, Any], context: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    triage = parse_jsonish(row.get('ai_triage') or row.get('aiTriage'))
    ticket_context = context or {}
    conversation = triage.get('supportConversation')
    if not isinstance(conversation, list):
        conversation = []
    urgency = str(triage.get('urgency') or '').lower()
    admin_urgent = bool(
        triage.get('adminUrgent')
        or triage.get('needsAdminReview')
        or urgency == 'high'
    )
    refund_signal = has_refund_signal(
        row.get('category') or 'other',
        row.get('subject') or '',
        row.get('message') or '',
        triage,
    )
    cancel_signal = has_cancel_signal(
        row.get('category') or 'other',
        row.get('subject') or '',
        row.get('message') or '',
        triage,
    )

    return to_jsonable({
        'id': str(row.get('id') or ''),
        'userId': str(row.get('user_id') or row.get('userId') or ''),
        'userEmail': row.get('user_email') or row.get('userEmail'),
        'subject': row.get('subject') or '',
        'category': row.get('category') or 'other',
        'message': row.get('message') or '',
        'status': row.get('status') or 'open',
        'adminReply': row.get('admin_reply') or row.get('adminReply'),
        'aiSummary': row.get('ai_summary') or row.get('aiSummary'),
        'aiSuggestedReply': row.get('ai_suggested_reply') or row.get('aiSuggestedReply'),
        'aiTriage': triage,
        'aiConversation': conversation,
        'adminUrgent': admin_urgent,
        'repliedBy': str(row.get('replied_by') or row.get('repliedBy') or '') or None,
        'repliedAt': row.get('replied_at') or row.get('repliedAt'),
        'closedAt': row.get('closed_at') or row.get('closedAt'),
        'createdAt': row.get('created_at') or row.get('createdAt'),
        'updatedAt': row.get('updated_at') or row.get('updatedAt'),
        'refundSignal': refund_signal,
        'cancelSignal': cancel_signal,
        'refundEligibility': ticket_context.get('refundEligibility'),
        'retentionOffer': ticket_context.get('retentionOffer'),
        'subscription': ticket_context.get('subscription'),
        'usage': ticket_context.get('usage'),
    })
