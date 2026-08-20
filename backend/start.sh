#!/usr/bin/env bash
set -euo pipefail

# PostgreSQL conserva Alembic; el demo SQLite crea el esquema compatible directamente.
if python -c 'from app.core.config import get_settings; raise SystemExit(0 if get_settings().demo_mode else 1)'; then
  python migrations/bootstrap_demo.py
else
  alembic upgrade head
  python migrations/seed.py
fi

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
