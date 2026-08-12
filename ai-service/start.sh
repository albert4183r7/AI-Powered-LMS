#!/bin/bash
# Start the API Server. The background worker is automatically started by FastAPI lifecycle.
uvicorn app.main:app --host 0.0.0.0 --port $PORT
