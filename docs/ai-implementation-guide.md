# AI Implementation Guide

This document records how the AI module-generation feature is being built and
why each part exists. It is intentionally ordered as a hands-on learning path.

The approved product behavior, guardrails, acceptance criteria, and mandatory
phase order live in the
[AI Product Requirements Document](ai-product-requirements-document.md). This
guide explains the implementation; it does not replace the PRD.

All implementation steps must satisfy the repository's
[`coding-standards.md`](coding-standards.md) definition of done.

## Agreed product behavior

- The AI creates a complete module as a draft.
- A module contains an ordered list of lessons.
- Every generated lesson initially receives one generated presentation.
- Instructors can choose Short, Standard, or Comprehensive depth.
- The instruction is required; reference files are optional.
- RAG uses uploaded references when present.
- Web search runs only when the instructor explicitly requests it or enables it.
- Relevant images and diagrams from references may be selected for presentations.
- Output language is selected independently from the LMS interface language.
- Instructors review and publish generated content manually.

## Architecture

```text
Instructor browser
    -> Next.js LMS API
    -> Python FastAPI AI service
    -> generation job
    -> validated draft result
    -> Next.js saves module, lessons, and presentation metadata
```

The browser never calls the model provider directly. Next.js retains control of
authentication, instructor permissions, and LMS database writes.

## Completed step 1: Python service boundary

The `ai-service` directory contains a FastAPI application, environment-based
configuration, a `/health` endpoint, and an automated endpoint test. This proves
the Python runtime and HTTP boundary work before model code is introduced.

## Completed step 2: strict data contracts

Pydantic validates generation requests and planned modules. Unknown properties,
vague prompts, duplicate file IDs, and oversized module plans are rejected before
they reach the model or LMS database.

The contract mirrors the current LMS hierarchy:

```text
Module -> Lessons -> Presentations
```

## Completed step 3: frontend request shell

Instructors now have an AI prompt entry point on the dashboard and a dedicated,
responsive request form. The form collects the same values defined by the Python
contract and performs immediate file and prompt validation.

The form does not call EcoAPI yet. Its current final action reviews the request so
the UI can be tested without consuming credits or pretending generation succeeded.

## Completed step 4: persistent fake generation jobs

FastAPI now accepts validated module requests at
`POST /v1/generations/modules`, stores them in a separate `ai_jobs.db`, and
returns HTTP 202 with a job ID. A single worker claims queued work and writes a
validated fake module plan. The LMS can poll `GET /v1/generations/{job_id}`.

Running jobs are returned to the queue after a service restart. The fake
generator makes no network requests and consumes no model credits.

## Completed quality audit

The initial AI code was reviewed against the coding standards. Generic Python
names were replaced with domain-specific names, the worker now depends on a
`ModuleGenerator` protocol, runtime and development dependencies were separated,
and the large AI form was split into feature components and validation utilities.
Ruff, mypy strict mode, ESLint, TypeScript, and automated tests are required gates.

## Completed phase 4: protected service boundary

Login and registration now issue a signed, HTTP-only session cookie. Next.js
reloads the current user and role from the LMS database instead of trusting a user
ID sent by the browser.

The browser-facing create and status routes live under `/api/ai/generations`.
They accept only instructor and administrator sessions, then call FastAPI with a
separate internal key and the authenticated user ID. FastAPI rejects missing or
invalid service credentials and stores the owner of every job. A different
instructor or administrator receives a not-found response rather than another
user's result.

The browser never receives the internal key and never communicates with FastAPI
directly. The health endpoint remains public for service monitoring.

## Completed phase 5: frontend job lifecycle

The validated request form now submits to the protected Next.js route and polls
job status with capped backoff. The interface announces honest queued,
processing, cancelling, cancelled, failed, and completed states; previews the
validated fake module plan; and supports retry from the original request.

Cancellation is owner-scoped through both Next.js and FastAPI. Queued jobs are
cancelled immediately. Processing jobs enter `cancelling`, and the worker
discards their result instead of allowing a completion race to overwrite the
cancellation. Restart recovery also finishes interrupted cancellations safely.

Reference files remain selectable for validating the future request experience,
but generation is explicitly blocked while files are selected because ingestion
does not exist until phase 8. The UI also states that the current result used no
model, web search, references, or provider credits.

## Completed phase 6: EcoAPI probe and provider adapter

The live capability probe established the working OpenAI-compatible base URL as
`https://www.ecoapi.ai/v1`, verified bearer authentication, the configured model,
chat completions, tool calls, SSE streaming, usage metadata, and the provider's
error envelope. The full observations and unresolved production checks are in
[`ecoapi-capability-probe.md`](ecoapi-capability-probe.md).

The tested model accepts `response_format` but does not enforce either JSON
Schema or JSON object output. The new typed adapter therefore validates provider
responses and normalizes errors, timeouts, access failures, and retryability
without claiming structured-output support. Provider secrets remain server-only.

The worker deliberately remains on `FakeModuleGenerator`. The EcoAPI adapter is
the lower-level provider boundary that the real `ModuleGenerator` implementation
will use next.

## Completed phase 7: real structured module planning

The EcoAPI adapter now powers real module generation when activated by
configuration. A prompt builder constructs system and user messages that embed
the `ModulePlan` JSON schema and depth-specific lesson targets. The generator
extracts JSON from potential markdown fences, validates every response with
Pydantic, and attempts bounded repair by re-prompting the model with its
validation errors.

Activation requires both `AI_SERVICE_USE_REAL_MODULE_GENERATOR=true` and a
configured `AI_SERVICE_ECOAPI_API_KEY`. When either is absent, the service
falls back to `FakeModuleGenerator` and logs the active generator at startup.
The EcoAPI client is properly closed on application shutdown.

Because the tested model does not enforce `response_format`, the implementation
never relies on provider-side JSON enforcement. All deterministic tests use
`httpx.MockTransport` and never contact the real provider.

## Completed phase 8: reference ingestion and visual catalog

Instructors can now attach reference files to a generation request. The
ingestion pipeline runs in the FastAPI AI service:

1. **Validation** — extension, size (25 MB max), magic bytes, and
   encryption heuristics reject bad files before parsing.
2. **Text extraction** — PyMuPDF extracts per-page text from PDF; python-pptx
   extracts per-slide text from PPTX; python-docx extracts paragraphs from
   DOCX; TXT is decoded with UTF-8 / latin-1 fallback. Every chunk records its
   source page or slide number for Phase 9 citation.
3. **Image extraction** — PDF, PPTX, and DOCX images are extracted and filtered
   by a configurable minimum dimension (default 100 × 100 px). Metadata and
   dimensions are stored in the visual catalog.
4. **Storage** — raw files, extracted text JSON, and images are stored under a
   UUID-namespaced directory. Metadata is persisted in two new SQLite tables
   (`reference_files`, `extracted_images`) in the existing `ai_jobs.db`.
5. **API** — four owner-scoped endpoints: upload, get metadata, list images,
   delete (with cascading storage cleanup).
6. **Next.js proxy** — `/api/ai/references/upload` and
   `/api/ai/references/[fileId]` forward authenticated requests to FastAPI.
7. **Frontend** — `ReferenceFilesSection` shows per-file upload status
   (spinner → checkmark + extracted stats, or red × on failure). The
   generation hook uploads files sequentially before submitting the job,
   and the blocking "references unavailable" guard is removed.

New dependencies: `pymupdf`, `python-docx`, `python-pptx`, `python-multipart`.
95 Python tests pass (48 new). TypeScript and ESLint pass with zero errors.

## Next step: phase 9

Implement embeddings, ChromaDB, and RAG. Use the extracted text chunks from
Phase 8 to build a local vector store with `intfloat/multilingual-e5-small`.
Query the store at generation time to inject the most relevant context into the
module planning prompt, and maintain citation provenance back to the source file
and page.
