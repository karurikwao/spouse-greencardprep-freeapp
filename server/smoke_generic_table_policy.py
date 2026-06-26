"""Smoke checks for the generic /api/table policy helpers.

This does not need a live database. It stubs the column catalog used by
api_routes so the safety rules can be checked locally and quickly.
"""

from flask import Flask

import auth
from routes import api_routes


SCHEMA = {
    'user_profiles': {
        'id', 'user_id', 'email', 'first_name', 'last_name', 'display_name',
        'referral_code', 'role', 'is_active', 'created_at', 'updated_at',
    },
    'user_subscriptions': {'user_id', 'plan_type', 'status', 'updated_at'},
    'support_tickets': {'id', 'user_id', 'subject', 'status'},
    'refund_requests': {'id', 'user_id', 'status'},
    'question_states': {
        'id', 'user_id', 'question_id', 'topic_id', 'comfort_status',
        'is_saved_for_later', 'last_reviewed_at', 'created_at', 'updated_at',
    },
}


def expect_value_error(fn, label):
    try:
        fn()
    except ValueError:
        return
    raise AssertionError(f'{label} should have raised ValueError')


def main():
    api_routes._TABLE_COLUMN_CACHE.clear()
    api_routes._TABLE_COLUMN_CACHE.update(SCHEMA)

    assert 'user_subscriptions' in api_routes.TABLES_WITH_USER_ID
    assert 'user_subscriptions' in api_routes.AUTO_USER_SCOPE_TABLES
    assert 'support_tickets' in api_routes.GENERIC_TABLE_RETIRED_WRITE_TABLES
    assert 'refund_requests' in api_routes.GENERIC_TABLE_RETIRED_WRITE_TABLES
    assert 'user_subscriptions' in api_routes.GENERIC_TABLE_RETIRED_WRITE_TABLES
    assert 'support_tickets' not in api_routes.GENERIC_TABLE_INSERT_TABLES
    assert 'refund_requests' not in api_routes.GENERIC_TABLE_INSERT_TABLES
    assert 'user_subscriptions' not in api_routes.GENERIC_TABLE_UPDATE_TABLES

    select_clause = api_routes._parse_select_clause(
        'user_profiles',
        'first_name,display_name,role',
    )
    assert '"first_name"' in select_clause
    assert '"display_name"' in select_clause
    assert '"role"' in select_clause

    expect_value_error(
        lambda: api_routes._parse_select_clause('user_profiles', 'first_name;drop'),
        'select SQL-ish column',
    )
    expect_value_error(
        lambda: api_routes._quote_column_for_operation(
            'user_profiles',
            'role',
            'update',
            is_admin=False,
            label='update column',
        ),
        'non-admin profile role update',
    )
    expect_value_error(
        lambda: api_routes._quote_column_for_operation(
            'question_states',
            'question_id desc',
            'read',
            label='order column',
        ),
        'order SQL-ish column',
    )
    expect_value_error(
        lambda: api_routes._validate_column_for_operation(
            'question_states',
            'topic_id',
            'conflict',
            label='conflict column',
        ),
        'disallowed upsert conflict column',
    )

    ok_conflict = api_routes._validate_column_for_operation(
        'question_states',
        'question_id',
        'conflict',
        label='conflict column',
    )
    assert ok_conflict == 'question_id'

    captured = {}

    def fake_query_all(sql, params=None):
        if 'information_schema.columns' in sql:
            table_name = params[0]
            return [{'column_name': column} for column in SCHEMA.get(table_name, set())]
        captured['sql'] = sql
        captured['params'] = params
        return []

    original_query_all = api_routes.db.query_all
    original_auth_lookup = auth.get_user_from_token
    try:
        api_routes.db.query_all = fake_query_all
        auth.get_user_from_token = lambda token: {
            'id': 'user-1',
            'email': 'user@example.com',
            'role': 'user',
        }
        app = Flask(__name__)
        app.register_blueprint(api_routes.api_bp, url_prefix='/api')
        client = app.test_client()

        unauth = client.get('/api/table/user_profiles')
        assert unauth.status_code == 401

        blocked_write = client.patch(
            '/api/table/user_subscriptions?eq=user_id&eqValue=user-1',
            json={'status': 'active'},
            headers={'Authorization': 'Bearer test-token'},
        )
        assert blocked_write.status_code == 410

        scoped_read = client.get(
            '/api/table/user_profiles?select=user_id,email&eq=user_id&eqValue=user-2',
            headers={'Authorization': 'Bearer test-token'},
        )
        assert scoped_read.status_code == 200
        assert '"user_id" = %s' in captured['sql']
        assert captured['params'][0] == 'user-1'

        malicious_order = client.get(
            '/api/table/user_profiles?order=user_id%20desc',
            headers={'Authorization': 'Bearer test-token'},
        )
        assert malicious_order.status_code == 400
    finally:
        api_routes.db.query_all = original_query_all
        auth.get_user_from_token = original_auth_lookup

    print('generic table policy smoke checks passed')


if __name__ == '__main__':
    main()
