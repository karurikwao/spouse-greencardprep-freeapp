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
    'monthly': 'Spouse Interview Premium Monthly - Robin + PDF Guides',
    'lifetime': 'Spouse Interview Lifetime Access - Robin + PDF Guides',
    'interviewPass': 'Spouse Interview 90-Day Interview Pass - Robin + PDF Guides',
}

PLAN_CHECKOUT_DETAILS = {
    'monthly': {
        'summary': 'Monthly premium access with 1,200+ USCIS-style practice questions, premium PDF guides, partner sync, and 20 daily Robin chats.',
        'terms': '$19.99 today, then $19.99 each month until canceled. Cancel anytime from your dashboard; access continues through the paid billing period.',
    },
    'lifetime': {
        'summary': 'One-time lifetime premium access with 1,200+ USCIS-style practice questions, premium PDF guides, partner sync, and 30 daily Robin chats.',
        'terms': '$79.99 one-time payment for lifetime access. No renewal is created.',
    },
    'interviewPass': {
        'summary': 'One-time 90-day premium pass with 1,200+ USCIS-style practice questions, premium PDF guides, partner sync, and 20 daily Robin chats.',
        'terms': '$39.99 one-time payment for 90 days of premium access. No renewal is created.',
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
                f"You are unlocking Spouse Interview premium: {details['summary']} "
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
@require_auth
def create_checkout_session():
    return _free_app_payment_retired_response('checkout')
    _refresh_stripe_key()
    user = request.current_user
    data = request.get_json()
    plan_type = data.get('planType')
    success_url = data.get('successUrl')
    cancel_url = data.get('cancelUrl')
    promo_code = data.get('promoCode')

    if plan_type not in PRICE_ENV_MAP:
        return jsonify({'error': 'Invalid plan type'}), 400

    if not stripe.api_key:
        return jsonify({'error': 'Stripe secret key is not configured', 'code': 'STRIPE_NOT_CONFIGURED'}), 503

    price_id = _get_price_id(plan_type)
    if not price_id:
        return jsonify({'error': 'Payment not configured for this plan', 'code': 'PRICE_NOT_CONFIGURED'}), 503
    _sync_checkout_product_copy(price_id, plan_type)

    discount_info = None
    promo_validation = None
    if promo_code and promo_code.strip():
        promo_validation = db.call_function('validate_promo_code', (promo_code.strip().upper(),))
        if isinstance(promo_validation, list):
            promo_validation = promo_validation[0] if promo_validation else None
        if promo_validation and promo_validation.get('valid') and promo_validation.get('discount_percent'):
            original = PLAN_PRICES[plan_type]
            discount_amount = round(original * promo_validation['discount_percent'] / 100)
            discount_info = {
                'originalPrice': original / 100,
                'discountPercent': promo_validation['discount_percent'],
                'discountAmount': discount_amount / 100,
                'finalPrice': (original - discount_amount) / 100,
            }

    existing_sub = db.query_one(
        """SELECT plan_type, status, provider_customer_id, provider_subscription_id
           FROM user_subscriptions WHERE user_id = %s""",
        (user['id'],)
    )
    customer_id = existing_sub['provider_customer_id'] if existing_sub else None
    existing_plan = existing_sub.get('plan_type') if existing_sub else None
    existing_status = existing_sub.get('status') if existing_sub else None
    existing_provider_ref = existing_sub.get('provider_subscription_id') if existing_sub else None

    if existing_plan == 'lifetime' and existing_status == 'active':
        return jsonify({
            'error': 'Lifetime access is already active for this account.',
            'code': 'ALREADY_LIFETIME',
        }), 409
    if existing_plan == 'monthly' and existing_status in ('active', 'canceled') and plan_type == 'monthly':
        return jsonify({
            'error': 'A monthly subscription is already attached to this account.',
            'code': 'MONTHLY_ALREADY_EXISTS',
        }), 409

    if not customer_id:
        try:
            customer = stripe.Customer.create(
                email=user['email'],
                metadata={
                    'user_id': user['id'],
                    'app_source': 'spouse_interview',
                    'promo_code': promo_validation.get('code', '') if promo_validation else '',
                }
            )
            customer_id = customer.id
            db.execute(
                """INSERT INTO user_subscriptions (user_id, provider, provider_customer_id, updated_at)
                   VALUES (%s, 'stripe', %s, now())
                   ON CONFLICT (user_id) DO UPDATE SET provider_customer_id = EXCLUDED.provider_customer_id, updated_at = now()""",
                (user['id'], customer_id)
            )
        except stripe.error.StripeError as e:
            return jsonify({'error': f'Failed to create customer: {str(e)}'}), 500

    frontend_url = os.getenv('FRONTEND_URL', request.headers.get('Origin', 'http://localhost:5173'))
    default_success = f"{frontend_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    default_cancel = f"{frontend_url}/billing/cancel"
    final_success_url = success_url or default_success
    if '{CHECKOUT_SESSION_ID}' not in final_success_url:
        separator = '&' if '?' in final_success_url else '?'
        final_success_url = f"{final_success_url}{separator}session_id={{CHECKOUT_SESSION_ID}}"

    is_subscription = plan_type == 'monthly'
    mode = 'subscription' if is_subscription else 'payment'

    session_params = {
        'customer': customer_id,
        'mode': mode,
        'success_url': final_success_url,
        'cancel_url': cancel_url or default_cancel,
        'line_items': [{'price': price_id, 'quantity': 1}],
        'client_reference_id': user['id'],
        'metadata': _checkout_metadata(user['id'], plan_type),
        'custom_text': _checkout_custom_text(plan_type),
    }
    payment_method_types = _checkout_payment_method_types()
    if payment_method_types:
        session_params['payment_method_types'] = payment_method_types

    if os.getenv('STRIPE_REQUIRE_TOS_CONSENT', '').lower() in ('1', 'true', 'yes'):
        session_params['consent_collection'] = {'terms_of_service': 'required'}
        session_params['custom_text']['terms_of_service_acceptance'] = {
            'message': (
                'I agree to the Terms of Service and Refund Policy for this Spouse Interview purchase.'
            )
        }

    if (
        plan_type == 'lifetime'
        and existing_plan in ('monthly', 'interviewPass')
        and existing_status in ('active', 'canceled', 'past_due', 'grace_period')
    ):
        session_params['metadata']['upgrade_from_plan'] = existing_plan
        if existing_provider_ref:
            session_params['metadata']['upgrade_from_provider_ref'] = existing_provider_ref

    if promo_validation and promo_validation.get('valid') and promo_validation.get('code'):
        session_params['metadata']['promo_code'] = promo_validation['code']
        session_params['metadata']['discount_percent'] = str(promo_validation.get('discount_percent', 0))
        session_params['metadata']['influencer_name'] = promo_validation.get('influencer_name', '')

    if not is_subscription:
        payment_metadata = _checkout_metadata(user['id'], plan_type)
        session_params['payment_intent_data'] = {
            'description': f"{PLAN_LABELS[plan_type]} - {PLAN_CHECKOUT_DETAILS[plan_type]['terms']}",
            'metadata': payment_metadata,
        }
    else:
        session_params['subscription_data'] = {
            'description': f"{PLAN_LABELS[plan_type]} - {PLAN_CHECKOUT_DETAILS[plan_type]['terms']}",
            'metadata': _checkout_metadata(user['id'], plan_type),
        }

    try:
        session = stripe.checkout.Session.create(**session_params)
    except stripe.error.StripeError as e:
        return jsonify({'error': f'Failed to create checkout session: {str(e)}'}), 500

    if promo_code and promo_code.strip():
        try:
            db.call_function('record_referral_event', (
                user['id'], promo_code.strip().upper(), 'stripe_checkout', None, 'checkout', json.dumps({'plan_type': plan_type})
            ))
        except Exception:
            pass

    response = {
        'checkoutUrl': session.url,
        'sessionId': session.id,
    }
    if discount_info:
        response['appliedDiscount'] = discount_info

    return jsonify(response)


@stripe_bp.route('/create-robin-credit-checkout-session', methods=['POST'])
@require_auth
def create_robin_credit_checkout_session():
    _refresh_stripe_key()
    if not stripe.api_key:
        return jsonify({'error': 'Stripe secret key is not configured', 'code': 'STRIPE_NOT_CONFIGURED'}), 503

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
@require_auth
def create_retention_checkout_session():
    return _free_app_payment_retired_response('retention checkout')
    _refresh_stripe_key()
    user = request.current_user
    data = request.get_json() or {}

    if not stripe.api_key:
        return jsonify({'error': 'Stripe secret key is not configured', 'code': 'STRIPE_NOT_CONFIGURED'}), 503

    sub = db.query_one(
        """SELECT plan_type, status, provider_customer_id, provider_subscription_id
           FROM user_subscriptions WHERE user_id = %s""",
        (user['id'],),
    )
    offer = build_retention_offer(
        sub.get('plan_type') if sub else None,
        sub.get('status') if sub else None,
    )
    if not offer.get('eligible'):
        return jsonify({
            'error': 'This account is not eligible for the retention offer.',
            'code': 'RETENTION_NOT_ELIGIBLE',
        }), 400

    customer_id = sub.get('provider_customer_id') if sub else None
    if not customer_id:
        try:
            customer = stripe.Customer.create(
                email=user['email'],
                metadata={'user_id': user['id'], 'app_source': 'spouse_interview'}
            )
            customer_id = customer.id
            db.execute(
                """INSERT INTO user_subscriptions (user_id, provider, provider_customer_id, updated_at)
                   VALUES (%s, 'stripe', %s, now())
                   ON CONFLICT (user_id) DO UPDATE SET provider_customer_id = EXCLUDED.provider_customer_id, updated_at = now()""",
                (user['id'], customer_id)
            )
        except stripe.error.StripeError as e:
            return jsonify({'error': f'Failed to create customer: {str(e)}'}), 500

    frontend_url = os.getenv('FRONTEND_URL', request.headers.get('Origin', 'http://localhost:5173'))
    success_url = data.get('successUrl') or f"{frontend_url}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = data.get('cancelUrl') or f"{frontend_url}/dashboard?retention=canceled"
    if '{CHECKOUT_SESSION_ID}' not in success_url:
        separator = '&' if '?' in success_url else '?'
        success_url = f"{success_url}{separator}session_id={{CHECKOUT_SESSION_ID}}"

    metadata = _checkout_metadata(user['id'], 'interviewPass', {
        'retention_offer': 'true',
        'retention_from_plan': sub.get('plan_type') if sub else 'monthly',
        'retention_from_status': sub.get('status') if sub else '',
        'retention_terms': (
            f"${offer['amount']:.2f} one-time payment for 90 days of premium access. "
            "No renewal is created."
        ),
    })

    line_item = {
        'quantity': 1,
        'price_data': {
            'currency': offer.get('currency', 'usd'),
            'unit_amount': int(offer.get('amountCents') or 1900),
            'product_data': {
                'name': offer.get('label') or '90-Day Interview Pass Retention Offer',
                'description': 'Lower-cost 90-day premium access for users considering cancellation or refund.',
                'metadata': {
                    'app_source': 'spouse_interview',
                    'plan_type': 'interviewPass',
                    'retention_offer': 'true',
                },
            },
        },
    }

    configured_retention_price = os.getenv('STRIPE_PRICE_ID_RETENTION_INTERVIEW_PASS')
    if configured_retention_price:
        line_item = {'price': configured_retention_price, 'quantity': 1}

    retention_session_params = {
        'customer': customer_id,
        'mode': 'payment',
        'success_url': success_url,
        'cancel_url': cancel_url,
        'line_items': [line_item],
        'client_reference_id': user['id'],
        'metadata': metadata,
        'custom_text': {
            'submit': {
                'message': (
                    f"This is a one-time ${offer['amount']:.2f} payment for 90 days of premium access. "
                    "It does not create a monthly renewal. Refund requests remain subject to the refund policy."
                ),
            },
            'after_submit': {
                'message': 'A receipt and purchase confirmation will be sent by email after payment is complete.',
            },
        },
        'payment_intent_data': {
            'description': f"{offer.get('label')} - one-time ${offer['amount']:.2f} for 90 days",
            'metadata': metadata,
        },
    }
    payment_method_types = _checkout_payment_method_types()
    if payment_method_types:
        retention_session_params['payment_method_types'] = payment_method_types

    try:
        session = stripe.checkout.Session.create(**retention_session_params)
        return jsonify({
            'checkoutUrl': session.url,
            'sessionId': session.id,
            'offer': offer,
        })
    except stripe.error.StripeError as e:
        return jsonify({'error': f'Failed to create retention checkout session: {str(e)}'}), 500


@stripe_bp.route('/confirm-checkout-session', methods=['POST'])
@require_auth
def confirm_checkout_session():
    return _free_app_payment_retired_response('checkout confirmation')
    _refresh_stripe_key()
    if not stripe.api_key:
        return jsonify({'error': 'Stripe secret key is not configured', 'code': 'STRIPE_NOT_CONFIGURED'}), 503

    user = request.current_user
    data = request.get_json() or {}
    session_id = data.get('sessionId')
    if not session_id:
        return jsonify({'error': 'Checkout session ID required'}), 400

    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as e:
        return jsonify({'error': f'Unable to retrieve checkout session: {str(e)}'}), 502

    metadata = session.get('metadata', {}) or {}
    session_user_id = metadata.get('user_id') or session.get('client_reference_id')
    if str(session_user_id) != str(user['id']):
        return jsonify({'error': 'Checkout session does not belong to the current user'}), 403

    if session.get('status') != 'complete' or session.get('payment_status') not in ('paid', 'no_payment_required'):
        return jsonify({'error': 'Checkout session is not complete yet', 'code': 'CHECKOUT_NOT_COMPLETE'}), 409

    try:
        _handle_checkout_completed(session)
    except Exception as e:
        return jsonify({'error': f'Unable to activate subscription: {str(e)}'}), 500

    return jsonify({
        'success': True,
        'planType': metadata.get('plan_type'),
        'sessionId': session_id,
    })


@stripe_bp.route('/create-customer-portal', methods=['POST'])
@require_auth
def create_customer_portal():
    return _free_app_payment_retired_response('billing portal')
    _refresh_stripe_key()
    user = request.current_user

    existing_sub = db.query_one(
        "SELECT provider_customer_id FROM user_subscriptions WHERE user_id = %s",
        (user['id'],)
    )
    customer_id = existing_sub['provider_customer_id'] if existing_sub else None

    if not customer_id:
        return jsonify({'error': 'No Stripe customer found'}), 404

    frontend_url = os.getenv('FRONTEND_URL', request.headers.get('Origin', 'http://localhost:5173'))

    try:
        session = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=f"{frontend_url}/account",
        )
        return jsonify({'portalUrl': session.url, 'url': session.url})
    except stripe.error.StripeError as e:
        return jsonify({'error': f'Failed to create portal session: {str(e)}'}), 500


@stripe_bp.route('/cancel-subscription', methods=['POST'])
@require_auth
def cancel_subscription():
    return _free_app_payment_retired_response('subscription cancellation')
    _refresh_stripe_key()
    if not stripe.api_key:
        return jsonify({'error': 'Stripe secret key is not configured', 'code': 'STRIPE_NOT_CONFIGURED'}), 503

    user = request.current_user
    sub = db.query_one(
        """SELECT user_id, plan_type, status, provider_subscription_id, current_period_ends_at
           FROM user_subscriptions WHERE user_id = %s""",
        (user['id'],)
    )
    if not sub:
        return jsonify({'error': 'No subscription found', 'code': 'SUBSCRIPTION_NOT_FOUND'}), 404
    if sub.get('plan_type') != 'monthly':
        return jsonify({'error': 'Only monthly subscriptions can be canceled.', 'code': 'NOT_CANCELABLE'}), 400

    subscription_id = sub.get('provider_subscription_id')
    if not _is_stripe_subscription_id(subscription_id):
        return jsonify({'error': 'No active Stripe subscription found.', 'code': 'STRIPE_SUBSCRIPTION_NOT_FOUND'}), 404

    if sub.get('status') == 'canceled':
        return jsonify({
            'success': True,
            'status': 'canceled',
            'cancelAtPeriodEnd': True,
            'currentPeriodEndsAt': _as_iso(sub.get('current_period_ends_at')),
        })

    try:
        period_end = _schedule_subscription_cancellation(subscription_id) or _as_iso(sub.get('current_period_ends_at'))
    except stripe.error.StripeError as e:
        return jsonify({'error': f'Unable to cancel renewal: {str(e)}', 'code': 'STRIPE_CANCEL_FAILED'}), 502

    db.execute(
        """UPDATE user_subscriptions
           SET status = 'canceled',
               canceled_at = COALESCE(canceled_at, now()),
               current_period_ends_at = COALESCE(%s, current_period_ends_at),
               metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb,
               updated_at = now()
           WHERE user_id = %s""",
        (period_end, _metadata_json({'cancel_at_period_end': True, 'canceled_by': 'user'}), user['id'])
    )

    return jsonify({
        'success': True,
        'status': 'canceled',
        'cancelAtPeriodEnd': True,
        'currentPeriodEndsAt': period_end,
    })


@stripe_bp.route('/resume-subscription', methods=['POST'])
@require_auth
def resume_subscription():
    return _free_app_payment_retired_response('subscription renewal')
    _refresh_stripe_key()
    if not stripe.api_key:
        return jsonify({'error': 'Stripe secret key is not configured', 'code': 'STRIPE_NOT_CONFIGURED'}), 503

    user = request.current_user
    sub = db.query_one(
        """SELECT user_id, plan_type, status, provider_subscription_id, current_period_ends_at
           FROM user_subscriptions WHERE user_id = %s""",
        (user['id'],)
    )
    if not sub:
        return jsonify({'error': 'No subscription found', 'code': 'SUBSCRIPTION_NOT_FOUND'}), 404
    if sub.get('plan_type') != 'monthly':
        return jsonify({'error': 'Only monthly subscriptions can be resumed.', 'code': 'NOT_RESUMABLE'}), 400

    subscription_id = sub.get('provider_subscription_id')
    if not _is_stripe_subscription_id(subscription_id):
        return jsonify({'error': 'No Stripe subscription found.', 'code': 'STRIPE_SUBSCRIPTION_NOT_FOUND'}), 404

    try:
        period_end = _resume_subscription_renewal(subscription_id) or _as_iso(sub.get('current_period_ends_at'))
    except stripe.error.StripeError as e:
        return jsonify({'error': f'Unable to resume renewal: {str(e)}', 'code': 'STRIPE_RESUME_FAILED'}), 502

    db.execute(
        """UPDATE user_subscriptions
           SET status = 'active',
               canceled_at = NULL,
               ends_at = NULL,
               current_period_ends_at = COALESCE(%s, current_period_ends_at),
               metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb,
               updated_at = now()
           WHERE user_id = %s""",
        (period_end, _metadata_json({'cancel_at_period_end': False, 'resumed_by': 'user'}), user['id'])
    )

    return jsonify({
        'success': True,
        'status': 'active',
        'cancelAtPeriodEnd': False,
        'currentPeriodEndsAt': period_end,
    })


def _usage_counts_for_refund(user_id):
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

    return questions_completed, mock_interviews_completed


def _payment_reference_for_refund(subscription_row):
    provider_ref = subscription_row.get('provider_subscription_id')
    plan_type = subscription_row.get('plan_type')
    amount_cents = PLAN_PRICES.get(plan_type, 0)
    purchased_at = _coerce_datetime(subscription_row.get('created_at'))
    currency = 'usd'
    payment_intent_id = None
    charge_id = None
    subscription_id = provider_ref if _is_stripe_subscription_id(provider_ref) else None

    if _is_stripe_payment_intent_id(provider_ref):
        payment_intent = stripe.PaymentIntent.retrieve(provider_ref, expand=['latest_charge'])
        payment_intent_id = payment_intent.id
        amount_cents = payment_intent.get('amount_received') or payment_intent.get('amount') or amount_cents
        currency = payment_intent.get('currency') or currency
        purchased_at = _datetime_from_timestamp(payment_intent.get('created')) or purchased_at
        charge_id = _stripe_object_id(payment_intent.get('latest_charge'))
    elif _is_stripe_subscription_id(provider_ref):
        subscription = stripe.Subscription.retrieve(
            provider_ref,
            expand=['latest_invoice.payment_intent', 'latest_invoice.charge'],
        )
        subscription_id = subscription.id
        invoice = subscription.get('latest_invoice')
        if isinstance(invoice, str):
            invoice = stripe.Invoice.retrieve(invoice, expand=['payment_intent', 'charge'])

        if invoice:
            amount_cents = invoice.get('amount_paid') or invoice.get('total') or amount_cents
            currency = invoice.get('currency') or currency
            purchased_at = _datetime_from_timestamp(invoice.get('created')) or purchased_at

            payment_intent = invoice.get('payment_intent')
            payment_intent_id = _stripe_object_id(payment_intent)
            if payment_intent and not isinstance(payment_intent, str):
                amount_cents = payment_intent.get('amount_received') or amount_cents
                purchased_at = _datetime_from_timestamp(payment_intent.get('created')) or purchased_at
                charge_id = _stripe_object_id(payment_intent.get('latest_charge')) or charge_id

            charge_id = _stripe_object_id(invoice.get('charge')) or charge_id

    amount = round((amount_cents or 0) / 100, 2)
    return {
        'subscription_id': subscription_id,
        'payment_intent_id': payment_intent_id,
        'charge_id': charge_id,
        'amount': amount,
        'currency': currency,
        'purchased_at': purchased_at,
    }


def _refund_eligibility_status(reason, days_since_purchase, questions_completed, mock_interviews_completed):
    if reason == 'unauthorized_transaction':
        return 'eligible', 'Unauthorized transaction claim queued for priority manual review.'
    if (
        days_since_purchase <= 7
        and questions_completed < 25
        and mock_interviews_completed <= 1
    ):
        return 'eligible', 'Within the 7-day refund window and usage limits.'
    if (
        reason == 'unclear_purchase'
        and days_since_purchase <= 14
        and questions_completed < 25
        and mock_interviews_completed <= 1
    ):
        return 'eligible', 'Unclear purchase claim queued for manual review.'
    return 'not_eligible', 'Outside the standard refund window or usage limits; support can still review the details.'


@stripe_bp.route('/request-refund', methods=['POST'])
@require_auth
def request_refund():
    return _free_app_payment_retired_response('refund request')
    _refresh_stripe_key()
    if not stripe.api_key:
        return jsonify({'error': 'Stripe secret key is not configured', 'code': 'STRIPE_NOT_CONFIGURED'}), 503

    user = request.current_user
    data = request.get_json() or {}
    reason = (data.get('reason') or 'other').strip()
    additional_comments = (data.get('additionalComments') or '').strip()[:2000]

    sub = db.query_one(
        """SELECT user_id, plan_type, status, provider, provider_customer_id,
                  provider_subscription_id, created_at
           FROM user_subscriptions WHERE user_id = %s""",
        (user['id'],),
    )
    if not sub or sub.get('plan_type') == 'trial':
        return jsonify({'error': 'No paid Stripe purchase found for this account.', 'code': 'NO_PAID_PURCHASE'}), 404
    if sub.get('provider') != 'stripe':
        return jsonify({'error': 'Refund requests can only be automated for Stripe purchases.', 'code': 'NOT_STRIPE'}), 400

    try:
        reference = _payment_reference_for_refund(sub)
    except stripe.error.StripeError as e:
        return jsonify({'error': f'Unable to look up the Stripe payment: {str(e)}', 'code': 'STRIPE_LOOKUP_FAILED'}), 502

    if not reference.get('payment_intent_id') and not reference.get('charge_id'):
        return jsonify({'error': 'No refundable Stripe charge was found for this purchase.', 'code': 'PAYMENT_REFERENCE_NOT_FOUND'}), 400

    purchased_at = reference.get('purchased_at') or datetime.now(timezone.utc)
    days_since_purchase = max(0, (datetime.now(timezone.utc) - purchased_at).days)
    questions_completed, mock_interviews_completed = _usage_counts_for_refund(user['id'])
    eligibility_status, eligibility_note = _refund_eligibility_status(
        reason,
        days_since_purchase,
        questions_completed,
        mock_interviews_completed,
    )

    duplicate = db.query_one(
        """
        SELECT * FROM refund_requests
        WHERE user_id = %s
          AND COALESCE(stripe_payment_intent_id, '') = COALESCE(%s, '')
          AND COALESCE(stripe_charge_id, '') = COALESCE(%s, '')
          AND eligibility_status IN ('pending', 'eligible', 'not_eligible', 'approved')
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (user['id'], reference.get('payment_intent_id'), reference.get('charge_id')),
    )
    if duplicate:
        return jsonify({
            'success': True,
            'refundRequestId': str(duplicate['id']),
            'eligibilityStatus': duplicate['eligibility_status'],
            'message': 'A refund request for this payment is already on file.',
        })

    request_row = db.execute_returning(
        """
        INSERT INTO refund_requests (
            user_id, subscription_id, stripe_payment_intent_id, stripe_charge_id,
            plan_type, amount, currency, purchased_at, days_since_purchase,
            questions_completed, mock_interviews_completed, eligibility_status,
            reason, additional_comments
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            user['id'],
            reference.get('subscription_id'),
            reference.get('payment_intent_id'),
            reference.get('charge_id'),
            sub.get('plan_type'),
            reference.get('amount'),
            reference.get('currency'),
            purchased_at,
            days_since_purchase,
            questions_completed,
            mock_interviews_completed,
            eligibility_status,
            reason,
            additional_comments or eligibility_note,
        ),
    )

    try:
        db.call_function('create_user_notification', (
            user['id'], 'refund', 'Refund Request Submitted',
            f"Your refund request is marked {eligibility_status.replace('_', ' ')} for review.",
            None,
            json.dumps({
                'refund_id': str(request_row['id']),
                'reason': reason,
                'amount': float(reference.get('amount') or 0),
                'eligibility_note': eligibility_note,
            }),
        ))
    except Exception:
        pass

    return jsonify({
        'success': True,
        'refundRequestId': str(request_row['id']),
        'eligibilityStatus': eligibility_status,
        'amount': reference.get('amount'),
        'daysSincePurchase': days_since_purchase,
        'message': eligibility_note,
    })


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

    print('Ignoring legacy paid-plan checkout.session.completed in free app')
    return

    user_id = metadata.get('user_id')
    plan_type = metadata.get('plan_type')
    customer_id = session_data.get('customer')
    subscription_id = session_data.get('subscription')
    payment_intent_id = session_data.get('payment_intent')
    provider_ref = subscription_id or payment_intent_id
    promo_code = metadata.get('promo_code')

    if not user_id or not plan_type:
        raise ValueError('Missing user_id or plan_type in session metadata')

    existing_subscription = db.query_one(
        "SELECT plan_type, status, provider_subscription_id FROM user_subscriptions WHERE user_id = %s",
        (user_id,)
    )
    should_send_purchase_email = (
        not existing_subscription
        or existing_subscription.get('status') != 'active'
        or existing_subscription.get('plan_type') != plan_type
        or (provider_ref and existing_subscription.get('provider_subscription_id') != provider_ref)
    )

    current_period_ends_at = None
    if plan_type == 'monthly' and subscription_id:
        current_period_ends_at = _retrieve_subscription_period_end(subscription_id)
    elif plan_type == 'interviewPass':
        current_period_ends_at = datetime.now(timezone.utc) + timedelta(days=90)

    meta = {'checkout_session_id': session_data.get('id')}
    if promo_code:
        meta['promo_code'] = promo_code
        meta['discount_percent'] = int(metadata.get('discount_percent', 0))

    if plan_type == 'lifetime' and existing_subscription and existing_subscription.get('plan_type') != 'lifetime':
        previous_provider_ref = existing_subscription.get('provider_subscription_id')
        meta['upgraded_from_plan'] = metadata.get('upgrade_from_plan') or existing_subscription.get('plan_type')
        if previous_provider_ref:
            meta['upgraded_from_provider_ref'] = previous_provider_ref
        if _is_stripe_subscription_id(previous_provider_ref):
            try:
                previous_period_end = _schedule_subscription_cancellation(previous_provider_ref)
                meta['previous_subscription_cancel_at_period_end'] = True
                if previous_period_end:
                    meta['previous_subscription_access_ends_at'] = previous_period_end
            except stripe.error.StripeError as e:
                meta['previous_subscription_cancel_error'] = str(e)[:240]
                print(f"Failed to schedule prior Stripe subscription cancellation for user {user_id}: {e}")

    db.call_function('create_or_update_subscription', (
        user_id, plan_type, 'active', 'stripe', customer_id,
        provider_ref,
        None,
        current_period_ends_at,
        json.dumps(meta)
    ))

    if plan_type == 'lifetime':
        db.execute(
            """UPDATE user_subscriptions
               SET current_period_ends_at = NULL,
                   canceled_at = NULL,
                   ends_at = NULL,
                   payment_failed_at = NULL,
                   payment_failure_count = 0,
                   updated_at = now()
               WHERE user_id = %s""",
            (user_id,)
        )

    if promo_code:
        try:
            db.call_function('record_referral_event', (
                user_id, promo_code, 'stripe_checkout', None, 'purchase',
                json.dumps({'plan_type': plan_type, 'session_id': session_data.get('id')})
            ))
        except Exception:
            pass

    if should_send_purchase_email:
        recipient = None
        try:
            customer_details = session_data.get('customer_details', {}) or {}
            recipient = customer_details.get('email')
            if not recipient:
                user_row = db.query_one("SELECT email FROM users WHERE id = %s", (user_id,))
                recipient = user_row['email'] if user_row else None
            if recipient:
                send_purchase_confirmation_email(recipient, plan_type, session_data.get('id'))
        except Exception as e:
            print(f"Purchase confirmation email failed for user {user_id}: {e}")
        try:
            if not recipient:
                user_row = db.query_one("SELECT email FROM users WHERE id = %s", (user_id,))
                recipient = user_row['email'] if user_row else None
            send_lifecycle_dashboard_message(user_id, recipient, 'upgrade')
        except Exception as e:
            print(f"Dashboard upgrade message failed for user {user_id}: {e}")


def _handle_subscription_updated(subscription_data):
    customer_id = subscription_data.get('customer')
    subscription_id = subscription_data.get('id')
    status = subscription_data.get('status')
    period_end = subscription_data.get('current_period_end')
    cancel_at_end = subscription_data.get('cancel_at_period_end', False)

    sub = db.query_one(
        """SELECT user_id, plan_type, status, provider_subscription_id
           FROM user_subscriptions WHERE provider_customer_id = %s""",
        (customer_id,)
    )
    if not _subscription_event_matches_current(sub, subscription_id):
        return

    status_map = {
        'active': 'canceled' if cancel_at_end else 'active',
        'trialing': 'active',
        'canceled': 'canceled',
        'past_due': 'past_due',
        'unpaid': 'unpaid',
        'paused': 'grace_period',
    }
    our_status = status_map.get(status, 'active')

    if period_end:
        from datetime import datetime, timezone
        period_end_dt = datetime.fromtimestamp(period_end, tz=timezone.utc).isoformat()
    else:
        period_end_dt = None

    db.execute(
        """UPDATE user_subscriptions SET status = %s, provider_subscription_id = %s,
           current_period_ends_at = %s,
           canceled_at = CASE WHEN %s THEN COALESCE(canceled_at, now()) ELSE NULL END,
           ends_at = CASE WHEN %s THEN ends_at ELSE NULL END,
           updated_at = now() WHERE user_id = %s""",
        (our_status, subscription_id, period_end_dt, cancel_at_end, cancel_at_end, sub['user_id'])
    )


def _handle_subscription_deleted(subscription_data):
    customer_id = subscription_data.get('customer')
    subscription_id = subscription_data.get('id')
    sub = db.query_one(
        """SELECT user_id, plan_type, provider_subscription_id
           FROM user_subscriptions WHERE provider_customer_id = %s""",
        (customer_id,)
    )
    if not _subscription_event_matches_current(sub, subscription_id):
        return

    db.execute(
        "UPDATE user_subscriptions SET status = 'expired', ends_at = now(), updated_at = now() WHERE user_id = %s",
        (sub['user_id'],)
    )


def _handle_invoice_paid(invoice_data):
    customer_id = invoice_data.get('customer')
    subscription_id = invoice_data.get('subscription')
    if not subscription_id:
        return

    sub = db.query_one(
        """SELECT user_id, plan_type, provider_subscription_id
           FROM user_subscriptions WHERE provider_customer_id = %s""",
        (customer_id,)
    )
    if not _subscription_event_matches_current(sub, subscription_id):
        return

    period_end = invoice_data.get('period_end')
    if period_end:
        from datetime import datetime, timezone
        period_end_dt = datetime.fromtimestamp(period_end, tz=timezone.utc).isoformat()
    else:
        period_end_dt = None

    db.execute(
        """UPDATE user_subscriptions SET status = 'active',
           current_period_ends_at = %s,
           canceled_at = NULL,
           ends_at = NULL,
           payment_failed_at = NULL,
           payment_failure_count = 0,
           updated_at = now()
           WHERE user_id = %s""",
        (period_end_dt, sub['user_id'])
    )


def _handle_payment_failed(invoice_data):
    customer_id = invoice_data.get('customer')
    subscription_id = invoice_data.get('subscription')
    if not subscription_id:
        return

    sub = db.query_one(
        """SELECT user_id, plan_type, provider_subscription_id
           FROM user_subscriptions WHERE provider_customer_id = %s""",
        (customer_id,)
    )
    if not _subscription_event_matches_current(sub, subscription_id):
        return

    db.execute(
        """UPDATE user_subscriptions
           SET status = 'past_due',
               payment_failed_at = now(),
               payment_failure_count = COALESCE(payment_failure_count, 0) + 1,
               updated_at = now()
           WHERE user_id = %s""",
        (sub['user_id'],)
    )
