#!/bin/bash
# Start the background worker
python app/jobs/worker.py &
# Start the API Server
uvicorn app.main:app --host 0.0.0.0 --port $PORT
