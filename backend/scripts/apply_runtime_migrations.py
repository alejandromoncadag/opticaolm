#!/usr/bin/env python3
from pathlib import Path
import sys


def main() -> int:
    backend_dir = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(backend_dir))

    from main import (
        ensure_historia_schema,
        ensure_ventas_schema,
        ensure_consultas_schema,
        ensure_pacientes_schema,
        ensure_reporting_views,
    )

    steps = [
        ("ensure_historia_schema", ensure_historia_schema),
        ("ensure_ventas_schema", ensure_ventas_schema),
        ("ensure_consultas_schema", ensure_consultas_schema),
        ("ensure_pacientes_schema", ensure_pacientes_schema),
        ("ensure_reporting_views", ensure_reporting_views),
    ]

    for name, fn in steps:
        fn()
        print(f"[OK] {name}")

    print("Runtime migrations completed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
