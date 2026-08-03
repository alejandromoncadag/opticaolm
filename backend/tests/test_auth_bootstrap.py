from __future__ import annotations

import asyncio
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import unittest
from unittest.mock import patch
from uuid import uuid4

import psycopg
from passlib.hash import argon2


BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

import main as backend_main


class NonCommittingConnection:
    """Keep bootstrap and login calls inside one rollback-only transaction."""

    def __init__(self, connection: psycopg.Connection):
        self.connection = connection

    def __enter__(self):
        return self

    def __exit__(self, _exc_type, _exc, _traceback):
        return False

    def cursor(self):
        return self.connection.cursor()

    def commit(self):
        return None


def auth_snapshot(connection: psycopg.Connection, username: str) -> tuple:
    with connection.cursor() as cur:
        cur.execute(
            """
            SELECT password_hash, password_changed_at, pwd_changed_at
            FROM core.usuarios
            WHERE username = %s;
            """,
            (username,),
        )
        row = cur.fetchone()
    if row is None:
        raise AssertionError(f"Missing auth fixture {username!r}")
    return row


async def asgi_post_json(app, path: str, payload: dict) -> tuple[int, dict]:
    body = json.dumps(payload).encode("utf-8")
    request_sent = False
    messages: list[dict] = []

    async def receive() -> dict:
        nonlocal request_sent
        if request_sent:
            return {"type": "http.disconnect"}
        request_sent = True
        return {"type": "http.request", "body": body, "more_body": False}

    async def send(message: dict) -> None:
        messages.append(message)

    scope = {
        "type": "http",
        "asgi": {"version": "3.0"},
        "http_version": "1.1",
        "method": "POST",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": b"",
        "headers": [
            (b"content-type", b"application/json"),
            (b"content-length", str(len(body)).encode("ascii")),
        ],
        "client": ("127.0.0.1", 50000),
        "server": ("127.0.0.1", 8000),
        "root_path": "",
    }
    await app(scope, receive, send)
    status = next(message["status"] for message in messages if message["type"] == "http.response.start")
    response_body = b"".join(
        message.get("body", b"")
        for message in messages
        if message["type"] == "http.response.body"
    )
    return status, json.loads(response_body)


class AuthenticationBootstrapTests(unittest.TestCase):
    def setUp(self) -> None:
        self.connection = psycopg.connect(backend_main.DB_CONNINFO)
        with self.connection.cursor() as cur:
            cur.execute("SELECT to_regclass('core.usuarios') IS NOT NULL;")
            if not cur.fetchone()[0]:
                self.connection.close()
                self.skipTest("core.usuarios is not available")
        self.wrapper = NonCommittingConnection(self.connection)

    def tearDown(self) -> None:
        if not self.connection.closed:
            self.connection.rollback()
            self.connection.close()

    def _startup_twice(self) -> None:
        no_op_targets = (
            "ensure_historia_schema",
            "ensure_ventas_schema",
            "ensure_finanzas_schema",
            "ensure_consultas_schema",
            "ensure_pacientes_schema",
            "ensure_reporting_views",
            "_load_google_calendar_env_cache",
        )
        patches = [patch.object(backend_main, target) for target in no_op_targets]
        for current_patch in patches:
            current_patch.start()
        try:
            backend_main.startup_migrations()
            backend_main.startup_migrations()
        finally:
            for current_patch in reversed(patches):
                current_patch.stop()

    def test_existing_admin_hash_survives_startup_restart_and_real_login(self) -> None:
        username = f"auth_existing_{uuid4().hex}"
        custom_password = secrets.token_urlsafe(24)
        ignored_bootstrap_password = secrets.token_urlsafe(24)
        custom_hash = argon2.hash(custom_password)
        with self.connection.cursor() as cur:
            cur.execute(
                """
                INSERT INTO core.usuarios (
                  username, password_hash, rol, role, sucursal_id, activo,
                  password_changed_at, pwd_changed_at
                )
                VALUES (%s, %s, 'admin', 'admin', NULL, true, NOW(), NOW());
                """,
                (username, custom_hash),
            )
        before = auth_snapshot(self.connection, username)

        output = StringIO()
        environment = {
            "ADMIN_USER": username,
            "ADMIN_PASS": ignored_bootstrap_password,
            "SEED_ADMIN_USERNAME": username,
            "SEED_ADMIN_PASSWORD": ignored_bootstrap_password,
            "SEED_ADMIN_RESET_PASSWORD": "true",
            "SEED_STAFF_RESET_PASSWORD": "true",
        }
        with (
            patch.dict(os.environ, environment, clear=False),
            patch.object(backend_main.psycopg, "connect", return_value=self.wrapper),
            redirect_stdout(output),
            redirect_stderr(output),
        ):
            self._startup_twice()
            first_status, first_login = asyncio.run(
                asgi_post_json(
                    backend_main.app,
                    "/login",
                    {"username": username, "password": custom_password},
                )
            )
            second_status, second_login = asyncio.run(
                asgi_post_json(
                    backend_main.app,
                    "/login",
                    {"username": username, "password": custom_password},
                )
            )

        self.assertEqual(200, first_status)
        self.assertEqual(200, second_status)
        self.assertIn("access_token", first_login)
        self.assertEqual(before, auth_snapshot(self.connection, username))
        self.assertNotIn(custom_password, output.getvalue())
        self.assertNotIn(ignored_bootstrap_password, output.getvalue())

    def test_missing_bootstrap_admin_is_created_once(self) -> None:
        username = f"auth_missing_{uuid4().hex}"
        bootstrap_password = secrets.token_urlsafe(24)
        environment = {
            "ADMIN_USER": username,
            "ADMIN_PASS": bootstrap_password,
            "SEED_ADMIN_USERNAME": username,
            "SEED_ADMIN_PASSWORD": bootstrap_password,
        }
        output = StringIO()
        with (
            patch.dict(os.environ, environment, clear=False),
            patch.object(backend_main.psycopg, "connect", return_value=self.wrapper),
            redirect_stdout(output),
            redirect_stderr(output),
        ):
            backend_main.ensure_auth_schema()
            first = auth_snapshot(self.connection, username)
            backend_main.ensure_auth_schema()
            second = auth_snapshot(self.connection, username)

        self.assertEqual(first, second)
        self.assertTrue(argon2.verify(bootstrap_password, first[0]))
        self.assertNotIn(bootstrap_password, output.getvalue())

    def test_import_main_does_not_change_real_admin_hash(self) -> None:
        before = auth_snapshot(self.connection, "admin")
        result = subprocess.run(
            [sys.executable, "-c", "import main"],
            cwd=BACKEND_DIR,
            check=True,
            capture_output=True,
            text=True,
        )
        after = auth_snapshot(self.connection, "admin")
        self.assertEqual(before, after)
        self.assertNotIn("password", result.stdout.lower())
        self.assertNotIn("password", result.stderr.lower())

    def test_interactive_reset_script_has_no_command_line_password(self) -> None:
        source = (BACKEND_DIR / "scripts" / "reset_admin_password.py").read_text(
            encoding="utf-8"
        )
        self.assertIn("getpass(", source)
        self.assertNotIn("sys.argv", source)
        self.assertIn("WHERE username = %s", source)


if __name__ == "__main__":
    unittest.main()
