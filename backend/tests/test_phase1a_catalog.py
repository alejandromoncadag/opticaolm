from __future__ import annotations

import re
import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = BACKEND_DIR / "scripts"
MIGRATION_PATH = (
    SCRIPTS_DIR
    / "migrations"
    / "20260801_phase1a_global_catalog.sql"
)

sys.path.insert(0, str(BACKEND_DIR))
sys.path.insert(0, str(SCRIPTS_DIR))

import main as backend_main
import psycopg

from verify_phase1a_catalog import (
    EXPECTED_MEDIA,
    LEGACY_TABLES,
    fingerprint_legacy_tables,
    verify_catalog,
    verify_media,
)


class Phase1ACatalogTests(unittest.TestCase):
    def test_migration_contains_no_prohibited_operations(self) -> None:
        migration = MIGRATION_PATH.read_text(encoding="utf-8")
        prohibited = re.findall(
            r"\b(?:DROP|DELETE|TRUNCATE|CASCADE)\b",
            migration,
            flags=re.IGNORECASE,
        )
        self.assertEqual([], prohibited)
        self.assertNotRegex(
            migration,
            r"(?i)COMMENT\s+ON\s+TABLE\s+core\.productos",
        )

    def test_catalog_database_invariants(self) -> None:
        with psycopg.connect(backend_main.DB_CONNINFO) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SET TRANSACTION READ ONLY")
                checks = verify_catalog(cursor)
        self.assertEqual(6, len(checks))

    def test_legacy_tables_remain_fingerprintable(self) -> None:
        with psycopg.connect(backend_main.DB_CONNINFO) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SET TRANSACTION READ ONLY")
                fingerprints = fingerprint_legacy_tables(cursor)
        self.assertEqual(set(LEGACY_TABLES), set(fingerprints))
        for fingerprint in fingerprints.values():
            self.assertEqual(64, len(fingerprint["data_sha256"]))
            self.assertEqual(64, len(fingerprint["schema_sha256"]))

    def test_copied_media_matches_source_manifest(self) -> None:
        results = verify_media(require_destination=True)
        self.assertEqual(len(EXPECTED_MEDIA), len(results))
        for item in results:
            self.assertEqual(item["source_sha256"], item["destination_sha256"])


if __name__ == "__main__":
    unittest.main()
