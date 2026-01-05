#!/bin/sh

echo "Running database migrations and seed..."
python -m app.scripts.seed_admin

echo "Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000



