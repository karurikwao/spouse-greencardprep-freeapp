import hashlib
import html as html_tools
import os
import re
from typing import Any, Dict, List, Optional

import requests


PLUNK_SEND_URL = 'https://next-api.useplunk.com/v1/send'
RESEND_SEND_URL = 'https://api.resend.com/emails'

PLAN_LABELS = {
    'monthly': 'Robin Credit Pack',
    'lifetime': 'Robin Credit Pack',
    'interviewPass': 'Robin Credit Pack',
}

PLAN_SUMMARIES = {
    'monthly': 'Optional extra Robin messages for the free app',
    'lifetime': 'Optional extra Robin messages for the free app',
    'interviewPass': 'Optional extra Robin messages for the free app',
}


def _frontend_url() -> str:
    return os.getenv('FRONTEND_URL', 'http://localhost:5173').rstrip('/')


def _from_address() -> str:
    return (
        os.getenv('RESEND_FROM_EMAIL')
        or os.getenv('PLUNK_FROM_EMAIL')
        or os.getenv('EMAIL_FROM')
        or 'Spouse Interview <noreply@spouseinterview.com>'
    )


def _from_sender() -> str | Dict[str, str]:
    sender = _from_address().strip()
    match = re.match(r'^(?P<name>.*?)\s*<(?P<email>[^<>@\s]+@[^<>@\s]+)>$', sender)
    if match:
        return {
            'name': match.group('name').strip().strip('"') or 'Spouse Interview',
            'email': match.group('email').strip(),
        }
    return sender


def _reply_address() -> Optional[str]:
    return os.getenv('RESEND_REPLY_TO') or os.getenv('PLUNK_REPLY_TO') or os.getenv('EMAIL_REPLY_TO') or None


def _clean_subject(subject: str) -> str:
    return ' '.join((subject or '').split())[:998] or 'Spouse Interview notification'


def _tag_data(tags: Optional[List[Dict[str, str]]]) -> Dict[str, object]:
    data: Dict[str, object] = {'source': {'value': 'spouse_interview', 'persistent': False}}

    for tag in tags or []:
        name = ''.join(ch if ch.isalnum() else '_' for ch in str(tag.get('name') or '').strip()).strip('_')
        value = str(tag.get('value') or '').strip()
        if name and value:
            data[f'tag_{name}'] = {'value': value[:250], 'persistent': False}

    return data


def _idempotency_key(*parts: str) -> str:
    source = '|'.join(part or '' for part in parts)
    digest = hashlib.sha256(source.encode('utf-8')).hexdigest()
    return f'spouse-interview-{digest}'


def _rich_email_fragment(value: str) -> str:
    text = str(value or '')
    if not re.search(r'</?[a-z][\s\S]*>', text, flags=re.IGNORECASE):
        escaped = html_tools.escape(text).replace('\n', '<br>')
        return re.sub(
            r'(https?://[^\s<]+|mailto:[^\s<]+|tel:[^\s<]+)',
            lambda match: f'<a href="{html_tools.escape(match.group(0), quote=True)}">{html_tools.escape(match.group(0))}</a>',
            escaped,
        )

    cleaned = re.sub(
        r'<\s*(script|style)[^>]*>.*?<\s*/\s*\1\s*>',
        '',
        text,
        flags=re.IGNORECASE | re.DOTALL,
    )
    cleaned = re.sub(r'\son\w+\s*=\s*(".*?"|\'.*?\'|[^\s>]+)', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'javascript:', '', cleaned, flags=re.IGNORECASE)
    return cleaned


def _plain_text_from_rich(value: str) -> str:
    text = re.sub(r'<\s*br\s*/?>', '\n', str(value or ''), flags=re.IGNORECASE)
    text = re.sub(r'<[^>]+>', '', text)
    return html_tools.unescape(text).strip()


def send_email(
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    tags: Optional[List[Dict[str, str]]] = None,
    idempotency_key: Optional[str] = None,
) -> Dict[str, object]:
    preferred_provider = (os.getenv('EMAIL_PROVIDER') or '').strip().lower()
    resend_key = (os.getenv('RESEND_API_KEY') or os.getenv('RESEND_SECRET_KEY') or '').strip()
    plunk_key = (os.getenv('PLUNK_SECRET_KEY') or os.getenv('PLUNK_API_KEY') or '').strip()
    provider = 'resend' if resend_key and preferred_provider != 'plunk' else 'plunk'
    if preferred_provider in {'resend', 'plunk'}:
        provider = preferred_provider
    api_key = resend_key if provider == 'resend' else plunk_key

    if not api_key:
        print(f'[DEV] Email skipped: RESEND_API_KEY/PLUNK_SECRET_KEY is not configured for "{subject}" to {to_email}')
        return {'success': True, 'skipped': True}

    if provider == 'resend':
        return _send_resend_email(
            api_key,
            to_email,
            subject,
            html_body,
            text_body,
            idempotency_key,
        )

    return _send_plunk_email(
        api_key,
        to_email,
        subject,
        html_body,
        text_body,
        tags,
        idempotency_key,
    )


def _send_plunk_email(
    api_key: str,
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    tags: Optional[List[Dict[str, str]]] = None,
    idempotency_key: Optional[str] = None,
) -> Dict[str, object]:
    payload = {
        'from': _from_sender(),
        'to': to_email,
        'subject': _clean_subject(subject),
        'body': html_body or html_tools.escape(text_body or ''),
        'data': _tag_data(tags),
    }
    reply_to = _reply_address()
    if reply_to:
        payload['reply'] = reply_to

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    if idempotency_key:
        payload['headers'] = {'X-Spouse-Interview-Idempotency-Key': idempotency_key[:256]}

    timeout_seconds = float(os.getenv('PLUNK_TIMEOUT_SECONDS', '5'))
    send_url = os.getenv('PLUNK_API_URL', PLUNK_SEND_URL)

    try:
        response = requests.post(send_url, json=payload, headers=headers, timeout=timeout_seconds)
        if response.status_code >= 400:
            print(f'Plunk email failed ({response.status_code}) for "{subject}": {response.text[:500]}')
            return {'success': False, 'error': response.text[:500], 'status_code': response.status_code}

        data = response.json()
        emails = (data.get('data') or {}).get('emails') or []
        email_id = emails[0].get('email') if emails and isinstance(emails[0], dict) else None
        return {'success': True, 'id': email_id, 'provider': 'plunk'}
    except requests.RequestException as exc:
        print(f'Plunk email request failed for "{subject}": {exc}')
        return {'success': False, 'error': str(exc)}


def _send_resend_email(
    api_key: str,
    to_email: str,
    subject: str,
    html_body: str,
    text_body: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Dict[str, object]:
    payload: Dict[str, object] = {
        'from': _from_address(),
        'to': [to_email],
        'subject': _clean_subject(subject),
        'html': html_body or html_tools.escape(text_body or ''),
    }
    if text_body:
        payload['text'] = text_body
    reply_to = _reply_address()
    if reply_to:
        payload['reply_to'] = reply_to
    if idempotency_key:
        payload['headers'] = {'X-Spouse-Interview-Idempotency-Key': idempotency_key[:256]}

    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
    }
    timeout_seconds = float(os.getenv('RESEND_TIMEOUT_SECONDS', os.getenv('PLUNK_TIMEOUT_SECONDS', '5')))
    send_url = os.getenv('RESEND_API_URL', RESEND_SEND_URL)

    try:
        response = requests.post(send_url, json=payload, headers=headers, timeout=timeout_seconds)
        if response.status_code >= 400:
            print(f'Resend email failed ({response.status_code}) for "{subject}": {response.text[:500]}')
            return {'success': False, 'error': response.text[:500], 'status_code': response.status_code}

        data = response.json()
        return {'success': True, 'id': data.get('id'), 'provider': 'resend'}
    except requests.RequestException as exc:
        print(f'Resend email request failed for "{subject}": {exc}')
        return {'success': False, 'error': str(exc)}


def send_welcome_email(to_email: str, first_name: Optional[str] = None) -> Dict[str, object]:
    name = html_tools.escape((first_name or '').strip() or 'there')
    dashboard_url = f'{_frontend_url()}/dashboard'

    html_body = f"""
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h1 style="font-size: 24px; margin-bottom: 12px;">Welcome to Spouse Interview</h1>
      <p>Hi {name},</p>
      <p>Your spouse green card interview prep account is ready. You can start practicing questions, saving progress, downloading free PDFs, and using Robin within the daily free limit.</p>
      <p>
        <a href="{dashboard_url}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 12px 18px; border-radius: 6px; text-decoration: none;">
          Open your dashboard
        </a>
      </p>
      <p style="color: #475569; font-size: 14px;">If you did not create this account, you can ignore this email.</p>
    </div>
    """
    text_body = (
        f'Hi {first_name or "there"},\n\n'
        'Your Spouse Interview account is ready. You can start using the free practice tools from your dashboard.\n'
        f'Open your dashboard: {dashboard_url}\n'
    )
    return send_email(
        to_email,
        'Welcome to Spouse Interview',
        html_body,
        text_body,
        tags=[{'name': 'category', 'value': 'welcome'}],
        idempotency_key=_idempotency_key('welcome', to_email),
    )


def send_purchase_confirmation_email(
    to_email: str,
    plan_type: str,
    checkout_session_id: Optional[str] = None,
) -> Dict[str, object]:
    plan_label = PLAN_LABELS.get(plan_type, 'Robin Credit Pack')
    plan_summary = PLAN_SUMMARIES.get(plan_type, 'Optional extra Robin messages for the free app')
    dashboard_url = f'{_frontend_url()}/dashboard'
    billing_url = f'{_frontend_url()}/account'

    html_body = f"""
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h1 style="font-size: 24px; margin-bottom: 12px;">Your Spouse Interview access is ready</h1>
      <p>Your account update for <strong>{html_tools.escape(plan_label)}</strong> has been recorded.</p>
      <p>{html_tools.escape(plan_summary)}. Core practice tools, PDF access, and partner collaboration remain included in the free app.</p>
      <p>
        <a href="{dashboard_url}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 12px 18px; border-radius: 6px; text-decoration: none;">
          Continue practicing
        </a>
      </p>
      <p style="color: #475569; font-size: 14px;">You can review account settings here: <a href="{billing_url}">{billing_url}</a></p>
    </div>
    """
    text_body = (
        f'Your account update for {plan_label} has been recorded.\n'
        f'{plan_summary}.\n'
        f'Continue practicing: {dashboard_url}\n'
        f'Account settings: {billing_url}\n'
    )
    return send_email(
        to_email,
        'Your Spouse Interview access is ready',
        html_body,
        text_body,
        tags=[{'name': 'category', 'value': 'purchase_confirmation'}],
        idempotency_key=_idempotency_key('purchase', checkout_session_id or to_email, plan_type),
    )


def send_password_reset_message(to_email: str, reset_url: str) -> Dict[str, object]:
    escaped_url = html_tools.escape(reset_url, quote=True)
    html_body = f"""
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h1 style="font-size: 24px; margin-bottom: 12px;">Reset your password</h1>
      <p>Use the secure link below to reset your Spouse Interview password.</p>
      <p>
        <a href="{escaped_url}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 12px 18px; border-radius: 6px; text-decoration: none;">
          Reset password
        </a>
      </p>
      <p style="color: #475569; font-size: 14px;">This link expires in 1 hour. If you did not request a reset, you can ignore this email.</p>
    </div>
    """
    text_body = f'Click the link to reset your password: {reset_url}\nThis link expires in 1 hour.'
    return send_email(
        to_email,
        'Reset your Spouse Interview password',
        html_body,
        text_body,
        tags=[{'name': 'category', 'value': 'password_reset'}],
        idempotency_key=_idempotency_key('password_reset', to_email, reset_url),
    )


def send_support_ticket_admin_email(
    to_email: str,
    ticket: Dict[str, Any],
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, object]:
    context = context or {}
    ticket_id = str(ticket.get('id') or '')
    user_email = html_tools.escape(str(ticket.get('userEmail') or ticket.get('user_email') or 'Unknown user'))
    subject_text = str(ticket.get('subject') or 'Support request')
    category = str(ticket.get('category') or 'other')
    message = str(ticket.get('message') or '')
    admin_url = f'{_frontend_url()}/dashboard'
    refund = context.get('refundEligibility') or {}
    offer = context.get('retentionOffer') or {}

    refund_line = ''
    if ticket.get('refundSignal') or category == 'refund':
        refund_line = (
            f"<p><strong>Refund review:</strong> {html_tools.escape(str(refund.get('status') or 'review'))} - "
            f"{html_tools.escape(str(refund.get('note') or 'Manual review recommended.'))}</p>"
        )

    offer_line = ''
    if offer.get('eligible'):
        offer_line = (
            f"<p><strong>Retention option:</strong> {html_tools.escape(str(offer.get('label')))} "
            f"for ${float(offer.get('amount') or 0):.2f}.</p>"
        )

    html_body = f"""
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h1 style="font-size: 22px; margin-bottom: 12px;">New support ticket</h1>
      <p><strong>From:</strong> {user_email}</p>
      <p><strong>Category:</strong> {html_tools.escape(category)}</p>
      <p><strong>Subject:</strong> {html_tools.escape(subject_text)}</p>
      {refund_line}
      {offer_line}
      <div style="border-left: 3px solid #cbd5e1; padding-left: 12px; margin: 16px 0;">
        {html_tools.escape(message).replace(chr(10), '<br>')}
      </div>
      <p><a href="{admin_url}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 10px 14px; border-radius: 6px; text-decoration: none;">Open admin dashboard</a></p>
    </div>
    """
    text_body = (
        f'New support ticket from {ticket.get("userEmail") or ticket.get("user_email") or "Unknown user"}\n'
        f'Category: {category}\n'
        f'Subject: {subject_text}\n\n'
        f'{message}\n\n'
        f'Open admin dashboard: {admin_url}\n'
    )
    return send_email(
        to_email,
        f'New support ticket: {subject_text[:90]}',
        html_body,
        text_body,
        tags=[{'name': 'category', 'value': 'support_ticket'}],
        idempotency_key=_idempotency_key('support_ticket', ticket_id, to_email),
    )


def send_refund_alert_admin_email(
    to_email: str,
    ticket: Dict[str, Any],
    context: Optional[Dict[str, Any]] = None,
) -> Dict[str, object]:
    context = context or {}
    refund = context.get('refundEligibility') or {}
    offer = context.get('retentionOffer') or {}
    user_email = html_tools.escape(str(ticket.get('userEmail') or ticket.get('user_email') or 'Unknown user'))
    subject_text = str(ticket.get('subject') or 'Refund-related support request')
    admin_url = f'{_frontend_url()}/dashboard'

    html_body = f"""
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h1 style="font-size: 22px; margin-bottom: 12px;">Refund-related ticket needs review</h1>
      <p><strong>User:</strong> {user_email}</p>
      <p><strong>Subject:</strong> {html_tools.escape(subject_text)}</p>
      <p><strong>Eligibility signal:</strong> {html_tools.escape(str(refund.get('status') or 'review'))}</p>
      <p>{html_tools.escape(str(refund.get('note') or 'Manual review recommended.'))}</p>
      <p><strong>Usage:</strong> {html_tools.escape(str((context.get('usage') or {}).get('questionsCompleted', 0)))} questions, {html_tools.escape(str((context.get('usage') or {}).get('totalPdfDownloads', 0)))} PDF downloads.</p>
      <p><strong>Retention:</strong> {html_tools.escape(str(offer.get('message') or 'No retention offer recommended.'))}</p>
      <p><a href="{admin_url}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 10px 14px; border-radius: 6px; text-decoration: none;">Review in admin dashboard</a></p>
    </div>
    """
    text_body = (
        f'Refund-related ticket from {ticket.get("userEmail") or ticket.get("user_email") or "Unknown user"}\n'
        f'Subject: {subject_text}\n'
        f'Eligibility: {refund.get("status") or "review"} - {refund.get("note") or "Manual review recommended."}\n'
        f'Review: {admin_url}\n'
    )
    return send_email(
        to_email,
        f'Refund review needed: {subject_text[:90]}',
        html_body,
        text_body,
        tags=[{'name': 'category', 'value': 'refund_alert'}],
        idempotency_key=_idempotency_key('refund_alert', str(ticket.get('id') or ''), to_email),
    )


def send_support_reply_email(
    to_email: str,
    ticket: Dict[str, Any],
    reply: str,
) -> Dict[str, object]:
    subject_text = str(ticket.get('subject') or 'Support ticket')
    dashboard_url = f'{_frontend_url()}/messages'
    rich_reply = _rich_email_fragment(reply)
    html_body = f"""
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h1 style="font-size: 22px; margin-bottom: 12px;">Support replied to your ticket</h1>
      <p><strong>{html_tools.escape(subject_text)}</strong></p>
      <div style="border-left: 3px solid #2563eb; padding-left: 12px; margin: 16px 0;">
        {rich_reply}
      </div>
      <p><a href="{dashboard_url}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 10px 14px; border-radius: 6px; text-decoration: none;">Open messages</a></p>
    </div>
    """
    text_body = (
        f'Support replied to your ticket: {subject_text}\n\n'
        f'{_plain_text_from_rich(reply)}\n\n'
        f'Open messages: {dashboard_url}\n'
    )
    return send_email(
        to_email,
        f'Support reply: {subject_text[:90]}',
        html_body,
        text_body,
        tags=[{'name': 'category', 'value': 'support_reply'}],
        idempotency_key=_idempotency_key('support_reply', str(ticket.get('id') or ''), reply[:120]),
    )


def send_dashboard_message_email(
    to_email: str,
    title: str,
    message: str,
    action_url: Optional[str] = None,
    message_id: Optional[str] = None,
) -> Dict[str, object]:
    message_url = action_url or f'{_frontend_url()}/messages'
    html_body = f"""
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.6;">
      <h1 style="font-size: 22px; margin-bottom: 12px;">{html_tools.escape(title or 'New dashboard message')}</h1>
      <div style="border-left: 3px solid #0ea5e9; padding-left: 12px; margin: 16px 0;">
        {_rich_email_fragment(message)}
      </div>
      <p><a href="{html_tools.escape(message_url, quote=True)}" style="display: inline-block; background: #0f172a; color: #ffffff; padding: 10px 14px; border-radius: 6px; text-decoration: none;">Open your messages</a></p>
    </div>
    """
    text_body = (
        f'{title or "New dashboard message"}\n\n'
        f'{_plain_text_from_rich(message)}\n\n'
        f'Open messages: {message_url}\n'
    )
    return send_email(
        to_email,
        title or 'New Spouse Interview dashboard message',
        html_body,
        text_body,
        tags=[{'name': 'category', 'value': 'dashboard_message'}],
        idempotency_key=_idempotency_key('dashboard_message', to_email, message_id or title or '', message[:120]),
    )
