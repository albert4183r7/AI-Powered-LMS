# Lumen AI Service

This Python service will orchestrate module planning, retrieval-augmented
generation (RAG), web research, and presentation creation for the LMS.

The service currently contains a health endpoint, strict Pydantic contracts,
internal service authentication, owner-scoped persistent jobs, cancellation, a
fake background-generation worker, and an inactive typed EcoAPI adapter. The
worker does not use the real provider until structured planning is implemented.

Generated content follows the existing LMS hierarchy: one module contains an
ordered list of lessons, and every generated lesson receives one presentation.

## Local setup on Windows

From the repository root:

```powershell
cd ai-service
py -3.12 -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

## Run the service

```powershell
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Then open `http://127.0.0.1:8000/health`.

Set `AI_SERVICE_INTERNAL_API_KEY` in this directory's `.env` to the same
long random value used by Next.js. The documented fallback is for local
development only and is rejected when the Python service runs in production.

## Fake generation API

Create a queued job:

```text
POST /v1/generations/modules
```

Poll its status or retrieve its completed result:

```text
GET /v1/generations/{job_id}
```

Cancel queued or processing work:

```text
POST /v1/generations/{job_id}/cancel
```

Generation endpoints require both `X-Lumen-Internal-Key` and
`X-Lumen-User-Id` headers. They are intended for the trusted Next.js proxy,
not direct browser use. A job can be read only with the same user ID that
created it. A processing cancellation is finalized by the worker so a late fake
result cannot overwrite the cancelled state.

Jobs are stored in `ai_jobs.db`. The current worker returns deterministic fake
lesson plans and never calls an external model or consumes API credits.

## EcoAPI adapter

The server-side adapter uses `https://www.ecoapi.ai/v1` by default. Configure it
with the `AI_SERVICE_ECOAPI_*` variables documented in `.env.example`. These
settings do not activate EcoAPI in the worker.

Run one redacted, credit-consuming smoke probe only when explicitly needed:

```powershell
.\.venv\Scripts\python.exe -m scripts.probe_ecoapi
```

See `docs/ecoapi-capability-probe.md` for the verified provider behavior and
limitations.

## Run the tests

```powershell
.\.venv\Scripts\python.exe -m pytest
```

## Check code quality

```powershell
.\.venv\Scripts\python.exe -m ruff format --check app tests scripts
.\.venv\Scripts\python.exe -m ruff check app tests scripts
.\.venv\Scripts\python.exe -m mypy app
```
