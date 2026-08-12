#!/bin/bash
# Start the background worker
python -m app.jobs.worker &
# Start the API Server
uvicorn app.main:app --host 0.0.0.0 --port $PORT
