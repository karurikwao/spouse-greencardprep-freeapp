import os
import json
import uuid
from datetime import datetime, timedelta, timezone
import stripe
from flask import Blueprint, request, jsonify
from auth import require_auth, require_admin, optional_auth
from admin_settings import saved_robin_usage_config
import db
from email_service import send_purchase_confirmation_email
from lifecycle_messages import send_lifecycle_dashboard_message
from robin_credits import grant_robin_credits, get_user_robin_credit_summary
from support_service import build_retention_offer

stripe_bp = Blueprint('stripe', __name__)

stripe.api_key = os.getenv('STRIPE_SECRET_KEY', '')

PRICE_ENV_MAP = {
    'monthly': 'STRIPE_PRICE_ID_MONTHLY',
    'lifetime': 'STRIPE_PRICE_ID_LIFETIME',
    'interviewPass': 'STRIPE_PRICE_ID_INTERVIEW_PASS',
}

PLAN_PRICES = {
    'monthly': 1999,
    'lifetime': 7999,
    'interviewPass': 3999,
}

PLAN_LABELS = {
    'monthly': 'Spouse Interview Archived Monthly Plan - Retired',
    'lifetime': 'Spouse Interview Archived Lifetime Plan - Retired',
    'interviewPass': 'Spouse Interview Archived 90-Day Plan - Retired',
}

PLAN_CHECKOUT_DETAILS = {
    'monthly': {
        'summary': 'Retired legacy checkout. Core app access is free; use optional Robin credit packs only when enabled.',
        'terms': 'This legacy checkout is retired in the free app.',
    },
    'lifetime': {
        'summary': 'Retired legacy checkout. Core app access is free; use optional Robin credit packs only when enabled.',
        'terms': 'This legacy checkout is retired in the free app.',
    },
    'interviewPass': {
        'summary': 'Retired legacy checkout. Core app access is free; use optional Robin credit packs only when enabled.',
        'terms': 'This legacy checkout is retired in the free app.',
    },
}

REFUND_POLICY_SUMMARY = (
    'Refund requests are reviewed under the refund policy. Unauthorized or unclear purchase claims '
    'are prioritized for manual review.'
)


def _checkout_payment_method_types():
    """Default Checkout to card-only so Stripe does not vary methods by browser."""
    raw = os.getenv('STRIPE_CHECKOUT_PAYMENT_METHOD_TYPES', 'card').strip()
    if not raw or raw.lower() in ('auto', 'automatic', 'dashboard', 'dynamic'):
        return None
    return [method.strip() for method in raw.split(',') if method.strip()]


def _is_stripe_subscription_id(value):
    return bool(value and str(value).startswith('sub_'))


def _is_stripe_payment_intent_id(value):
    return bool(value and str(value).startswith('pi_'))


def _iso_from_timestamp(timestamp):
    if not timestamp:
        return None
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()


def _datetime_from_timestamp(timestamp):
    if not timestamp:
        return None
    return datetime.fromtimestamp(timestamp, tz=timezone.utc)


def _coerce_datetime(value):
    if not value:
        return None
    if isinstance(value, datetime):
        if value.tzinfo:
            return value
        return value.replace(tzinfo=timezone.utc)
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace('Z', '+00:00'))
        except ValueError:
            return None
    return None


def _as_iso(value):
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    return value


def _retrieve_subscription_period_end(subscription_id):
    if not _is_stripe_subscription_id(subscription_id):
        return None
    try:
        subscription = stripe.Subscription.retrieve(subscription_id)
        return _iso_from_timestamp(subscription.get('current_period_end'))
    except stripe.error.StripeError:
        return None


def _schedule_subscription_cancellation(subscription_id):
    if not _is_stripe_subscription_id(subscription_id):
        return None
    subscription = stripe.Subscription.modify(subscription_id, cancel_at_period_end=True)
    return _iso_from_timestamp(subscription.get('current_period_end'))


def _resume_subscription_renewal(subscription_id):
    if not _is_stripe_subscription_id(subscription_id):
        return None
    subscription = stripe.Subscription.modify(subscription_id, cancel_at_period_end=False)
    return _iso_from_timestamp(subscription.get('current_period_end'))


def _metadata_json(updates):
    return json.dumps({k: v for k, v in updates.items() if v is not None})


def _stripe_object_id(value):
    if not value:
        return None
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get('id')
    return getattr(value, 'id', None)


def _checkout_metadata(user_id, plan_type, extra=None):
    details = PLAN_CHECKOUT_DETAILS[plan_type]
    metadata = {
        'user_id': user_id,
        'plan_type': plan_type,
        'plan_label': PLAN_LABELS[plan_type],
        'purchase_summary': details['summary'],
        'purchase_terms': details['terms'],
        'refund_policy': REFUND_POLICY_SUMMARY,
        'terms_version': '2026-05-25',
        'app_source': 'spouse_interview',
    }
    if extra:
        metadata.update(extra)
    return metadata


def _checkout_custom_text(plan_type):
    details = PLAN_CHECKOUT_DETAILS[plan_type]
    return {
        'submit': {
            'message': (
                f"This Spouse Interview legacy checkout is retired: {details['summary']} "
                f"{details['terms']} {REFUND_POLICY_SUMMARY}"
            ),
        },
        'after_submit': {
            'message': 'A receipt and purchase confirmation will be sent by email after payment is complete.',
        },
    }


def _checkout_product_description(plan_type):
    details = PLAN_CHECKOUT_DETAILS[plan_type]
    return f"{details['summary']} {details['terms']} {REFUND_POLICY_SUMMARY}"


def _sync_checkout_product_copy(price_id, plan_type):
    """Keep Stripe-hosted Checkout item copy explicit to reduce purchase confusion."""
    if not price_id:
        return
    try:
        price = stripe.Price.retrieve(price_id, expand=['product'])
        product = price.get('product') if isinstance(price, dict) else getattr(price, 'product', None)
        product_id = _stripe_object_id(product)
        if not product_id:
            return
        stripe.Product.modify(
            product_id,
            name=PLAN_LABELS[plan_type],
            description=_checkout_product_description(plan_type),
            metadata={
                'app_source': 'spouse_interview',
                'plan_type': plan_type,
                'purchase_summary': PLAN_CHECKOUT_DETAILS[plan_type]['summary'],
                'refund_policy': REFUND_POLICY_SUMMARY,
            },
        )
    except stripe.error.StripeError:
        pass


def _subscription_event_matches_current(sub, incoming_subscription_id):
    if not sub or not incoming_subscription_id:
        return False
    if sub.get('plan_type') == 'lifetime':
        return False
    current_subscription_id = sub.get('provider_subscription_id')
    return not current_subscription_id or current_subscription_id == incoming_subscription_id


def _refresh_stripe_key():
    stripe.api_key = os.getenv('STRIPE_SECRET_KEY', '')
    return stripe.api_key


def _get_or_create_test_price(plan_type):
    secret_key = _refresh_stripe_key()
    if not secret_key.startswith('sk_test_'):
        return None

    lookup_key = f"interviewready_{plan_type}_test_v1"
    existing = stripe.Price.list(lookup_keys=[lookup_key], active=True, limit=1)
    if existing.data:
        return existing.data[0].id

    product = stripe.Product.create(
        name=PLAN_LABELS[plan_type],
        description=_checkout_product_description(plan_type),
        metadata={
            'app_source': 'spouse_interview',
            'plan_type': plan_type,
            'environment': 'test',
        }
    )

    params = {
        'unit_amount': PLAN_PRICES[plan_type],
        'currency': 'usd',
        'product': product.id,
        'lookup_key': lookup_key,
        'metadata': {
            'app_source': 'spouse_interview',
            'plan_type': plan_type,
            'environment': 'test',
        }
    }

    if plan_type == 'monthly':
        params['recurring'] = {'interval': 'month'}

    price = stripe.Price.create(**params)
    return price.id


def _get_price_id(plan_type):
    env_var = PRICE_ENV_MAP[plan_type]
    configured = os.getenv(env_var)
    if configured:
        return configured

    auto_create = os.getenv('STRIPE_AUTO_CREATE_TEST_PRICES', 'true').lower() in ('1', 'true', 'yes')
    if auto_create:
        try:
            return _get_or_create_test_price(plan_type)
        except stripe.error.StripeError:
            return None

    return None


def _safe_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _frontend_url():
    return os.getenv('FRONTEND_URL', request.headers.get('Origin', 'http://localhost:5173')).rstrip('/')


def _active_robin_credit_packs():
    settings = saved_robin_usage_config()
    packs = settings.get('paidPacks') if isinstance(settings.get('paidPacks'), list) else []
    return [
        pack for pack in packs
        if pack.get('active')
        and _safe_int(pack.get('messages')) > 0
        and _safe_int(pack.get('priceCents')) > 0
    ]


def _find_robin_credit_pack(pack_id):
    normalized_pack_id = str(pack_id or '').strip().lower()
    for pack in _active_robin_credit_packs():
        if str(pack.get('id') or '').strip().lower() == normalized_pack_id:
            return pack
    return None


def _get_or_create_stripe_customer_for_user(user):
    existing_sub = db.query_one(
        """SELECT provider_customer_id
           FROM user_subscriptions
           WHERE user_id = %s""",
        (user['id'],),
    )
    customer_id = existing_sub.get('provider_customer_id') if existing_sub else None
    if customer_id:
        return customer_id

    customer = stripe.Customer.create(
        email=user.get('email'),
        metadata={
            'user_id': user['id'],
            'app_source': 'spouse_interview',
        },
    )
    db.execute(
        """INSERT INTO user_subscriptions (user_id, provider, provider_customer_id, updated_at)
           VALUES (%s, 'stripe', %s, now())
           ON CONFLICT (user_id) DO UPDATE SET
             provider = 'stripe',
             provider_customer_id = EXCLUDED.provider_customer_id,
             updated_at = now()""",
        (user['id'], customer.id),
    )
    return customer.id


def _robin_credit_checkout_metadata(user_id, pack):
    return {
        'purchase_type': 'robin_credit_pack',
        'user_id': str(user_id),
        'pack_id': str(pack.get('id') or ''),
        'pack_label': str(pack.get('label') or 'Robin Credit Pack')[:120],
        'messages': str(_safe_int(pack.get('messages'))),
        'price_cents': str(_safe_int(pack.get('priceCents'))),
        'expiration_days': str(_safe_int(pack.get('expirationDays'), 365)),
        'rollover': 'true' if pack.get('rollover', True) else 'false',
        'app_source': 'spouse_interview',
    }


def _free_app_payment_retired_response(action='payment'):
    return jsonify({
        'success': False,
        'code': 'FREE_APP_PAYMENT_RETIRED',
        'error': f'The legacy {action} workflow is retired in the free app.',
        'message': (
            'Spouse Interview core access is free. Optional Robin credit packs use the separate '
            'credit-pack workflow when Stripe is configured.'
        ),
    }), 410


@stripe_bp.route('/create-checkout-session', methods=['POST'])
def create_checkout_session():
    return _free_app_payment_retired_response('checkout')

@stripe_bp.route('/create-robin-credit-checkout-session', methods=['POST'])
@require_auth
def create_robin_credit_checkout_session():
    _refresh_stripe_key()
    if not stripe.api_key:
        return jsonify({'error': 'Stripe secret key is not configured', 'code': 'STRIPE_NOT_CONFIGURED'}), 503

    settings = saved_robin_usage_config()
    if not settings.get('paidCreditPacksEnabled', False):
        return jsonify({
            'error': settings.get('creditPacksUnavailableMessage') or 'Robin credit packs are not available yet.',
            'code': 'ROBIN_CREDIT_PACKS_DISABLED',
        }), 403

    data = request.get_json() or {}
    pack = _find_robin_credit_pack(data.get('packId') or data.get('pack_id'))
    if not pack:
        return jsonify({'error': 'Robin credit pack is not available', 'code': 'PACK_NOT_AVAILABLE'}), 404

    user = request.current_user
    try:
        customer_id = _get_or_create_stripe_customer_for_user(user)
    except stripe.error.StripeError as e:
        return jsonify({'error': f'Failed to create customer: {str(e)}'}), 500

    frontend_url = _frontend_url()
    success_url = data.get('successUrl') or f"{frontend_url}/robin?credits=success&session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = data.get('cancelUrl') or f"{frontend_url}/robin?credits=cancelled"
    if '{CHECKOUT_SESSION_ID}' not in success_url:
        separator = '&' if '?' in success_url else '?'
        success_url = f"{success_url}{separator}session_id={{CHECKOUT_SESSION_ID}}"

    metadata = _robin_credit_checkout_metadata(user['id'], pack)
    payment_method_types = _checkout_payment_method_types()
    session_params = {
        'customer': customer_id,
        'mode': 'payment',
        'success_url': success_url,
        'cancel_url': cancel_url,
        'client_reference_id': user['id'],
        'metadata': metadata,
        'line_items': [
            {
                'price_data': {
                    'currency': 'usd',
                    'unit_amount': _safe_int(pack.get('priceCents')),
                    'product_data': {
                        'name': f"{pack.get('label') or 'Robin Credit Pack'} - {pack.get('messages')} Robin messages",
                        'description': (
                            f"{pack.get('messages')} optional extra Robin messages for the free Spouse Interview app. "
                            f"Credits expire after {pack.get('expirationDays')} days."
                        ),
                        'metadata': metadata,
                    },
                },
                'quantity': 1,
            }
        ],
        'custom_text': {
            'submit': {
                'message': (
                    'This is a one-time Robin credit pack. Core Spouse Interview access remains free. '
                    'Paid credits are used only after your daily free Robin messages are used.'
                ),
            },
            'after_submit': {
                'message': 'Your Robin credits will be added after payment is confirmed.',
            },
        },
        'payment_intent_data': {
            'description': f"{pack.get('label') or 'Robin Credit Pack'} for Spouse Interview",
            'metadata': metadata,
        },
    }
    if payment_method_types:
        session_params['payment_method_types'] = payment_method_types

    try:
        session = stripe.checkout.Session.create(**session_params)
    except stripe.error.StripeError as e:
        return jsonify({'error': f'Failed to create Robin credit checkout session: {str(e)}'}), 500

    return jsonify({
        'success': True,
        'checkoutUrl': session.url,
        'sessionId': session.id,
    })


@stripe_bp.route('/confirm-robin-credit-checkout-session', methods=['POST'])
@require_auth
def confirm_robin_credit_checkout_session():
    _refresh_stripe_key()
    if not stripe.api_key:
        return jsonify({'error': 'Stripe secret key is not configured', 'code': 'STRIPE_NOT_CONFIGURED'}), 503

    data = request.get_json() or {}
    session_id = str(data.get('sessionId') or data.get('session_id') or '').strip()
    if not session_id.startswith('cs_'):
        return jsonify({'error': 'Invalid Checkout session id'}), 400

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as e:
        return jsonify({'error': f'Unable to retrieve checkout session: {str(e)}'}), 502

    metadata = session.get('metadata', {}) or {}
    if metadata.get('purchase_type') != 'robin_credit_pack':
        return jsonify({'error': 'Checkout session is not a Robin credit purchase'}), 400
    if metadata.get('user_id') != request.current_user.get('id'):
        return jsonify({'error': 'Checkout session does not belong to this user'}), 403
    if session.get('payment_status') != 'paid':
        return jsonify({'success': False, 'code': 'PAYMENT_NOT_COMPLETE'}), 409

    try:
        summary = _handle_robin_credit_checkout_completed(session, metadata)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

    return jsonify({'success': True, 'credits': summary})


@stripe_bp.route('/create-retention-checkout-session', methods=['POST'])
def create_retention_checkout_session():
    return _free_app_payment_retired_response('retention checkout')

@stripe_bp.route('/confirm-checkout-session', methods=['POST'])
def confirm_checkout_session():
    return _free_app_payment_retired_response('checkout confirmation')

@stripe_bp.route('/create-customer-portal', methods=['POST'])
def create_customer_portal():
    return _free_app_payment_retired_response('billing portal')

@stripe_bp.route('/cancel-subscription', methods=['POST'])
def cancel_subscription():
    return _free_app_payment_retired_response('subscription cancellation')

@stripe_bp.route('/resume-subscription', methods=['POST'])
def resume_subscription():
    return _free_app_payment_retired_response('subscription renewal')

@stripe_bp.route('/request-refund', methods=['POST'])
def request_refund():
    return _free_app_payment_retired_response('refund request')

@stripe_bp.route('/webhook', methods=['POST'])
def stripe_webhook():
    _refresh_stripe_key()
    payload = request.data
    sig_header = request.headers.get('Stripe-Signature', '')
    webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET', '')

    if not webhook_secret:
        return jsonify({'error': 'Webhook not configured'}), 503

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except stripe.error.SignatureVerificationError:
        return jsonify({'error': 'Invalid signature'}), 400
    except Exception:
        return jsonify({'error': 'Invalid payload'}), 400

    existing = db.query_one(
        "SELECT id FROM stripe_webhook_events WHERE stripe_event_id = %s",
        (event['id'],)
    )
    if existing:
        return jsonify({'message': 'Already processed'}), 200

    try:
        if event['type'] == 'checkout.session.completed':
            _handle_checkout_completed(event['data']['object'])
        elif event['type'] in ('customer.subscription.created', 'customer.subscription.updated'):
            print(f"Ignoring legacy Stripe subscription event in free app: {event['type']}")
        elif event['type'] == 'customer.subscription.deleted':
            print(f"Ignoring legacy Stripe subscription deletion in free app: {event['type']}")
        elif event['type'] == 'invoice.paid':
            print(f"Ignoring legacy Stripe invoice event in free app: {event['type']}")
        elif event['type'] == 'invoice.payment_failed':
            print(f"Ignoring legacy Stripe invoice event in free app: {event['type']}")

        db.execute(
            """INSERT INTO stripe_webhook_events (stripe_event_id, event_type, status, processed_at)
               VALUES (%s, %s, 'success', now())
               ON CONFLICT (stripe_event_id) DO NOTHING""",
            (event['id'], event['type'])
        )
    except Exception as e:
        db.execute(
            """INSERT INTO stripe_webhook_events (stripe_event_id, event_type, status, error_message, processed_at)
               VALUES (%s, %s, 'error', %s, now())
               ON CONFLICT (stripe_event_id) DO NOTHING""",
            (event['id'], event['type'], str(e))
        )
        return jsonify({'error': str(e)}), 500

    return jsonify({'message': 'OK'}), 200


def _handle_robin_credit_checkout_completed(session_data, metadata=None):
    metadata = metadata or session_data.get('metadata', {}) or {}
    user_id = metadata.get('user_id')
    session_id = session_data.get('id')
    reference_id = session_id or _stripe_object_id(session_data.get('payment_intent')) or str(uuid.uuid4())

    if not user_id:
        raise ValueError('Missing user_id in Robin credit checkout metadata')

    existing = db.query_one(
        """
        SELECT id
        FROM robin_credit_ledger
        WHERE user_id = %s
          AND reference_id = %s
          AND event_type = 'purchase'
        LIMIT 1
        """,
        (user_id, reference_id),
    )
    if existing:
        return get_user_robin_credit_summary(user_id)

    messages = _safe_int(metadata.get('messages'))
    if messages <= 0:
        raise ValueError('Missing Robin credit message count in checkout metadata')

    label = metadata.get('pack_label') or 'Robin Credit Pack'
    pack_id = metadata.get('pack_id') or 'robin-credit-pack'
    expiration_days = _safe_int(metadata.get('expiration_days'), 365)
    rollover = str(metadata.get('rollover', 'true')).lower() in ('1', 'true', 'yes')
    payment_intent_id = _stripe_object_id(session_data.get('payment_intent'))
    customer_id = _stripe_object_id(session_data.get('customer'))

    summary = grant_robin_credits(
        user_id,
        messages,
        label=label,
        pack_id=pack_id,
        expiration_days=expiration_days,
        rollover=rollover,
        source_type='purchase',
        metadata={
            'source': 'stripe_checkout',
            'stripeSessionId': session_id,
            'paymentIntentId': payment_intent_id,
            'customerId': customer_id,
            'priceCents': _safe_int(metadata.get('price_cents')),
            'expirationDays': expiration_days,
            'rollover': rollover,
            'packId': pack_id,
        },
        reference_id=reference_id,
    )

    recipient = None
    try:
        customer_details = session_data.get('customer_details', {}) or {}
        recipient = customer_details.get('email')
        if not recipient:
            user_row = db.query_one("SELECT email FROM users WHERE id = %s", (user_id,))
            recipient = user_row['email'] if user_row else None
        if recipient:
            send_purchase_confirmation_email(recipient, 'robinCreditPack', session_id)
    except Exception as e:
        print(f"Robin credit purchase email failed for user {user_id}: {e}")

    try:
        db.call_function('create_user_notification', (
            user_id,
            'broadcast',
            'Robin credits added',
            f"Messages from Spouse Interview: {messages} extra Robin messages from {label} are ready in your account.",
            '/robin',
            json.dumps({
                'purchase_type': 'robin_credit_pack',
                'stripe_session_id': session_id,
                'payment_intent_id': payment_intent_id,
                'messages': messages,
                'pack_id': pack_id,
                'rich_content': True,
            }),
        ))
    except Exception as e:
        print(f"Robin credit dashboard message failed for user {user_id}: {e}")

    return summary


def _handle_checkout_completed(session_data):
    metadata = session_data.get('metadata', {}) or {}
    if metadata.get('purchase_type') == 'robin_credit_pack':
        _handle_robin_credit_checkout_completed(session_data, metadata)
        return

    print('Ignoring legacy purchase checkout.session.completed in free app')
