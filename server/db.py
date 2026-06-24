import os
import psycopg2
import psycopg2.extras
from contextlib import contextmanager
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://localhost:5432/greencardprep')


def get_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


@contextmanager
def get_db():
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_db_cursor():
    conn = get_connection()
    try:
        cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        yield cur
        conn.commit()
        cur.close()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def query_one(sql, params=None):
    with get_db_cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None


def query_all(sql, params=None):
    with get_db_cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
        return [dict(r) for r in rows]


def execute(sql, params=None):
    with get_db_cursor() as cur:
        cur.execute(sql, params)
        try:
            row = cur.fetchone()
            return dict(row) if row else None
        except psycopg2.ProgrammingError:
            return None


def execute_returning(sql, params=None):
    with get_db_cursor() as cur:
        cur.execute(sql, params)
        row = cur.fetchone()
        return dict(row) if row else None


def call_function(func_name, params=None):
    if params:
        placeholders = ', '.join(['%s'] * len(params))
        sql = f"SELECT * FROM {func_name}({placeholders})"
        with get_db_cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall()
            if len(rows) == 1:
                row = rows[0]
                if len(row) == 1:
                    return list(row.values())[0]
                return dict(row)
            return [dict(r) for r in rows]
    else:
        sql = f"SELECT * FROM {func_name}()"
        with get_db_cursor() as cur:
            cur.execute(sql)
            rows = cur.fetchall()
            if len(rows) == 1:
                row = rows[0]
                if len(row) == 1:
                    return list(row.values())[0]
                return dict(row)
            return [dict(r) for r in rows]
