import argparse
import sys
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parent
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from routes.ai_routes import _cleanup_dashboard_agent_memory_answers  # noqa: E402


def main():
    parser = argparse.ArgumentParser(
        description='Clean saved Robin answers that leaked internal planning text.'
    )
    parser.add_argument('--apply', action='store_true', help='Update matching rows. Omit for dry-run.')
    parser.add_argument('--limit', type=int, default=200, help='Maximum suspicious rows to scan.')
    parser.add_argument('--user-id', default=None, help='Optional user id to limit cleanup.')
    parser.add_argument('--show-sample', action='store_true', help='Print redacted before/after previews.')
    args = parser.parse_args()

    result = _cleanup_dashboard_agent_memory_answers(
        limit=args.limit,
        dry_run=not args.apply,
        user_id=args.user_id,
    )

    mode = 'APPLY' if args.apply else 'DRY RUN'
    print(f'Robin saved-answer cleanup: {mode}')
    print(f"Scanned suspicious rows: {result['scanned']}")
    print(f"Cleanable rows: {result['cleanable']}")
    print(f"Updated rows: {result['updated']}")

    if args.show_sample and result.get('sample'):
        print('\nSample cleaned rows:')
        for item in result['sample']:
            print(f"- id={item['id']} user={item['userId']}")
            print(f"  before={item['before']!r}")
            print(f"  after={item['after']!r}")


if __name__ == '__main__':
    main()
