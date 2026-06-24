import json

import db
from admin_settings import saved_welcome_message_config
from email_service import send_dashboard_message_email


DEFAULT_WELCOME_MESSAGES = {
    'signupEnabled': True,
    'upgradeEnabled': False,
    'sendEmail': True,
    'signupTitle': 'Welcome to Spouse Interview',
    'signupMessage': 'Your free account is ready. Start with your dashboard, build your timeline, and save questions for later review.',
    'upgradeTitle': 'Free access updated',
    'upgradeMessage': 'Your Spouse Interview access has been updated. Core practice tools, PDF access, partner sync, and Robin daily free usage are available from your dashboard.',
}


def lifecycle_settings():
    return {**DEFAULT_WELCOME_MESSAGES, **(saved_welcome_message_config() or {})}


def send_lifecycle_dashboard_message(user_id, email, event_type):
    settings = lifecycle_settings()
    if event_type == 'signup':
        enabled = bool(settings.get('signupEnabled', True))
        title = settings.get('signupTitle') or DEFAULT_WELCOME_MESSAGES['signupTitle']
        message = settings.get('signupMessage') or DEFAULT_WELCOME_MESSAGES['signupMessage']
    elif event_type == 'upgrade':
        enabled = bool(settings.get('upgradeEnabled', True))
        title = settings.get('upgradeTitle') or DEFAULT_WELCOME_MESSAGES['upgradeTitle']
        message = settings.get('upgradeMessage') or DEFAULT_WELCOME_MESSAGES['upgradeMessage']
    else:
        return False

    if not enabled:
        return False

    notification_id = None
    try:
        notification_id = db.call_function('create_user_notification', (
            user_id,
            'broadcast',
            title,
            message,
            '/messages',
            json.dumps({'lifecycle_event': event_type, 'rich_content': True}),
        ))
    except Exception:
        pass

    if settings.get('sendEmail', True) and email:
        try:
            send_dashboard_message_email(email, title, message, None, str(notification_id or user_id))
        except Exception:
            pass

    return True
