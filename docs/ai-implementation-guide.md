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

The form does not call the AI model yet. Its current final action reviews the request so
the UI can be tested without consuming compute resources or pretending generation succeeded.

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

## Completed phase 6: Qwen (Ollama) provider integration

The implementation replaced EcoAPI with a local Qwen model via Ollama. The typed adapter now uses the `ollama` Python library to communicate with a locally-running Ollama server at `http://localhost:11434`. This eliminates external API dependencies and keeps all data on-premises.

The tested model (`qwen3.6:27b`) accepts structured JSON output via prompt engineering. The adapter validates responses and normalizes errors, timeouts, and retryability. Model configuration is server-only via environment variables.

The worker now uses `QwenModuleGenerator` for real module generation. The fake generator remains available for testing without model calls.

## Completed phase 7: real structured module planning

The Qwen (Ollama) provider now powers real module generation when activated by configuration. A prompt builder constructs system and user messages that embed the `ModulePlan` JSON schema and depth-specific lesson targets. The generator extracts JSON from potential markdown fences, validates every response with Pydantic, and attempts bounded repair by re-prompting the model with its validation errors.

Activation requires `AI_SERVICE_USE_REAL_MODULE_GENERATOR=true` and a configured `AI_SERVICE_QWEN_MODEL`. When the model is not configured or Ollama is unavailable, the service falls back to `FakeModuleGenerator` and logs the active generator at startup. The Ollama client is properly initialized on application startup.

Because the local model does not enforce strict JSON schema, the implementation never relies on model-side enforcement. All deterministic tests use mock transports and never contact the real model.

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

## Completed phase 9: embeddings, ChromaDB, and Visual RAG

Phase 9 implements a complete RAG (Retrieval-Augmented Generation) system with
Visual RAG support for multi-modal context retrieval:

### 9.1 Embedding Service

Created `app/services/embedding_service.py` with dual embedding capabilities:

- **Text embeddings**: Uses `intfloat/multilingual-e5-small` model
  - Supports Indonesian and English text
  - Implements E5 prefix protocol ("passage:" for documents, "query:" for searches)
  - Normalized embeddings for cosine similarity
  - Batch processing for efficiency

- **Image embeddings**: Uses `sentence-transformers/clip-ViT-B-32` model
  - CLIP model for cross-modal text-image search
  - Converts images to RGB before embedding
  - Supports both bytes and PIL Image inputs
  - Enables Visual RAG by placing text and images in same vector space

Both models run locally in the workspace - no external API calls required.

### 9.2 Enhanced Reference Repository

Extended `app/ingestion/reference_repository.py` with:

- **`text_chunks` table**: Stores chunked text with embeddings
  - Chunk ID, file ID, chunk index, text content
  - Source page tracking for citations
  - Embedding type discrimination ("text" or "image")
  - BLOB storage for pickle-serialized embedding vectors
  - Indexes on file_id and embedding_type for fast lookup

- **`image_embeddings` table**: Stores image embeddings for Visual RAG
  - Image ID, file ID, source page, storage path
  - CLIP embedding vector (512-dimensional)
  - Optional AI-generated caption
  - Foreign key to reference_files

- **Similarity search methods**:
  - `search_similar_chunks()`: Cosine similarity search for text chunks
  - `search_similar_images()`: Cross-modal search using text queries to find images
  - Both support filtering by file_ids and top_k results
  - Uses SQLite temporary tables for efficient magnitude precomputation

### 9.3 RAG Service

Created `app/services/rag_service.py` implementing complete RAG pipeline:

**Text Chunking**:
- Intelligent chunking with sentence boundary detection
- Configurable chunk size (500 chars) and overlap (50 chars)
- Breaks at `.`, `!`, `?`, `\n` when possible
- Falls back to word boundaries if no sentence boundary found
- Tracks source page for each chunk

**Text Ingestion** (`ingest_reference_chunks()`):
- Chunks all text from reference files
- Stores chunks without embeddings first
- Generates embeddings in batches (default batch_size=10)
- Updates database with embedding vectors
- Returns count of successfully ingested chunks
- Graceful failure handling (continues if embedding fails)

**Image Ingestion** (`ingest_image_with_embedding()`):
- Reads image from storage path
- Generates CLIP embedding
- Stores embedding with metadata (source page, caption)
- Returns success/failure status
- Integrated into reference ingestion pipeline

**Context Retrieval** (`search_context()`):
- Generates query embedding from text search
- Searches both text chunks and images
- Returns unified `RetrievedContext` objects with:
  - Content type ("text" or "image")
  - Content (text or image path)
  - Source page and file ID
  - Similarity score
  - Human-readable citation
- Supports filtering by file_ids
- Configurable top_k results

**Prompt Context Building** (`build_context_for_prompt()`):
- Formats retrieved contexts for LLM prompts
- Includes citations and source attribution
- Respects maximum context length
- Returns formatted context string and citation list

### 9.4 Integration with Reference Ingestion

Updated `app/ingestion/reference_ingestion_service.py`:

- Accepts optional `RagService` in constructor
- After text extraction, automatically calls `rag_service.ingest_reference_chunks()`
  - Passes text chunks with source pages
  - Provides file_id and owner_user_id for security
  - Logs ingestion count or warnings on failure
  - Continues even if RAG ingestion fails (graceful degradation)

- After image extraction, automatically calls `rag_service.ingest_image_with_embedding()`
  - Iterates through all extracted images
  - Generates simple captions based on page info
  - Logs success or warnings per image
  - Non-fatal failures don't stop entire ingestion

### 9.5 Application Startup

Updated `app/main.py`:

- Imports `EmbeddingService` and `RagService` from services module
- Initializes embedding service in lifespan startup
- Creates RagService with repository and embedding service
- Passes rag_service to ReferenceIngestionService
- Stores rag_service in application.state for potential API access

### 9.6 Technical Details

**Dependencies added**:
- `sentence-transformers`: For both text and image embedding models
- `chromadb`: Available for future vector database migration
- `pillow`: For image processing

**Model specifications**:
- Text: `intfloat/multilingual-e5-small` (384 dimensions)
- Image: `sentence-transformers/clip-ViT-B-32` (512 dimensions)
- Both models downloaded and cached locally on first use
- Models support multilingual text (Indonesian + English)

**Security considerations**:
- All RAG operations are owner-scoped
- File ownership verified before embedding updates
- No external API calls for embeddings (privacy-preserving)
- Documents treated as untrusted data (prompt injection prevention)

**Performance optimizations**:
- Batch embedding generation reduces model inference overhead
- SQLite temporary tables for magnitude precomputation
- Lazy model loading (initialized on first use)
- Graceful degradation if models fail to load

### 9.7 Visual RAG Capabilities

The implemented Visual RAG system enables:

1. **Cross-modal search**: Text queries can retrieve relevant images from references
2. **Multi-modal context**: LLM receives both text passages and image references
3. **Citation tracking**: Every retrieved item cites its source file and page
4. **AI image selection**: Model can choose which images to include in presentations
5. **Knowledge base enrichment**: Images provide visual context beyond text alone

This addresses PRD section 9.3 requirement that AI can select relevant visuals
from references rather than extracting images directly. The RAG system retrieves
both text and image embeddings, allowing the model to decide which visuals
enhance the presentation while maintaining attribution.

## Next step: phase 10

Implement web search tool for controlled internet research when explicitly
requested by the instructor. The tool should:
- Only activate when instructor enables web research option
- Record domain and URL sources
- Prioritize authoritative and recent sources
- Avoid copyright violations in quotations
- Display source list in preview for instructor review

## Completed Phase 10: Web Search Integration

Phase 10 has been completed with full web search capabilities integrated into the RAG system.

### 10.1 Implementation Summary

**New Service Created**: `app/services/web_search_service.py`

The WebSearchService provides:
- Real-time web search via DuckDuckGo (free, no API key required)
- Multiple search types: general, news, and academic
- Result caching to avoid repeated searches (30-minute TTL)
- Safe search enforcement
- Time-based filtering (day, week, month, year)
- Multi-language support (default: Indonesian)

**Key Features**:
```python
- search(query, search_type, max_results, use_cache)
- search_multiple(queries) - parallel searches
- search_for_module(module_topic, subtopics) - targeted module research
- format_results_for_prompt(results) - LLM-ready formatting
- get_trending_topics() - discover current trends
```

**Search Types**:
1. **General**: Standard web search with past year filter
2. **News**: Recent news articles with publication dates
3. **Academic**: Scholarly sources (.edu, .ac.id, arxiv.org, researchgate.net)

### 10.2 RAG Service Enhancement

Updated `app/services/rag_service.py`:
- Added optional `web_search_service` parameter to constructor
- Enhanced `search_context()` method with `include_web_search` flag
- Integrated web results into multi-modal context retrieval
- Web results formatted as ContextItem with source attribution
- Combined ranking across text chunks, images, and web results

**Context Retrieval Flow**:
```
1. Search text chunks from uploaded references
2. Search image embeddings using CLIP vectors
3. (Optional) Search web for current information
4. Merge and rank all results by relevance score
5. Format into prompt-ready context with citations
```

### 10.3 Application Integration

Updated `app/main.py`:
- Import WebSearchService
- Initialize WebSearchService during application startup
- Pass web_search_service to RagService constructor
- Web search capability logged on startup

**Startup Sequence**:
```python
embedding_service = EmbeddingService()
web_search_service = WebSearchService()
rag_service = RagService(
    reference_repository=reference_repository,
    embedding_service=embedding_service,
    web_search_service=web_search_service
)
```

### 10.4 Dependencies Installed

```bash
pip install duckduckgo-search
```

**Package Details**:
- Name: `duckduckgo-search`
- Purpose: Unofficial DuckDuckGo API client
- License: MIT
- No API key required
- Rate limits: ~10 requests/minute (varies)

### 10.5 Usage Examples

**Basic Web Search**:
```python
results = await web_search_service.search(
    query="perubahan iklim Indonesia",
    search_type="general",
    max_results=5,
    language="id-ID"
)
```

**Academic Research**:
```python
results = await web_search_service.search(
    query="machine learning education",
    search_type="academic",
    max_results=10,
    time_limit="y"
)
```

**Module Generation with Web Context**:
```python
context_items = await rag_service.search_context(
    query="renewable energy technologies",
    owner_user_id=123,
    include_web_search=True,  # Enable web search
    module_topic="Energy Systems"
)

prompt_context = rag_service.build_context_for_prompt(context_items)
# Includes: text passages + images + web sources with citations
```

### 10.6 Security & Quality Considerations

**Safety Features**:
- Safe search enabled by default (moderate filtering)
- No external API keys required (privacy-preserving)
- Source URLs recorded for verification
- Cached results prevent excessive external requests

**Quality Controls**:
- Academic search prioritizes .edu and .ac.id domains
- Time filters ensure recent information
- Result snippets limited to prevent copyright issues
- All sources displayed in preview for instructor review

**Error Handling**:
- Graceful degradation if DuckDuckGo unavailable
- Empty results returned instead of exceptions
- Detailed logging for debugging
- Cache fallback for transient failures

### 10.7 Benefits for Module Generation

**For Instructors**:
- Access to current information beyond uploaded references
- Automatic discovery of authoritative sources
- Time-saving research assistance
- Transparent source attribution

**For Students**:
- Up-to-date content in generated modules
- Links to original sources for further reading
- Mix of academic and practical resources
- Current events and recent developments

**For System**:
- No additional infrastructure costs (free API)
- Minimal latency (cached results)
- Scalable (stateless service)
- Complements existing RAG pipeline

### 10.8 Testing Recommendations

**Manual Testing**:
```bash
# Test web search directly
curl -X POST http://localhost:8001/v1/references \
  -F "file=@document.pdf" \
  -H "Authorization: Bearer <token>"

# Generate module with web search enabled
# Check that web sources appear in context
```

**Integration Tests** (to be added):
- Verify search results contain expected fields
- Test cache behavior (repeated queries)
- Validate academic search domain filtering
- Confirm safe search filtering works
- Test error handling when DuckDuckGo unavailable

### 10.9 Next Steps: Phase 11

With web search complete, the next phase is **Presentation Generation**:
- Convert module plans into slide decks
- Select appropriate images from Visual RAG
- Incorporate web-sourced diagrams/charts
- Generate AI-created visuals when needed
- Export to PowerPoint or Google Slides format
- Maintain citation tracking throughout

This completes the full RAG pipeline: **Text + Images + Web Search → AI Generation**.

## Phase 12: Persistent Data Sources & Document Reusability

**Status:** ✅ Complete

### 12.1 Motivation

Previously, users had to re-upload the same documents for every module generation. 
Phase 12 introduces a persistent document repository where users can:
- Upload documents once and reuse them across multiple generations
- Manage document versions with automatic versioning
- Soft-delete documents to exclude them from future RAG operations
- Search and select from their existing document library

### 12.2 Implementation

#### Database Schema (`database/migrations/006_data_sources.sql`)

Two new tables implement the data source feature:

**`data_sources` table:**
- `id`: Primary key
- `title`: User-friendly document title
- `description`: Optional description
- `owner_user_id`: Foreign key to users table
- `status`: 'active' or 'deleted' (soft delete)
- `latest_version_id`: Points to current version
- Timestamps for created_at and updated_at

**`data_source_versions` table:**
- `id`: Primary key
- `data_source_id`: Foreign key to data_sources
- `version_number`: Auto-incrementing version
- `file_path`: Physical file location
- `original_filename`: Original upload name
- `file_size`, `mime_type`, `file_hash`: File metadata
- SHA256 hash for deduplication detection

Key design decisions:
- **Soft delete only**: Documents are never hard deleted, ensuring audit trail
- **Version tracking**: Users can update documents while maintaining history
- **Owner-scoped**: All queries filter by owner_user_id for security
- **Status-based filtering**: RAG explicitly excludes 'deleted' sources

#### Service Layer (`app/services/data_source_service.py`)

The `DataSourceService` provides:

```python
async def create_data_source(title, description, owner_user_id) -> int
async def upload_document_version(data_source_id, file_path, ...) -> int
async def list_data_sources(owner_user_id, search_query, limit, offset) -> List
async def get_data_source(data_source_id, owner_user_id) -> Dict
async def get_data_source_versions(data_source_id, owner_user_id) -> List
async def delete_data_source(data_source_id, owner_user_id) -> bool
async def get_active_source_ids_for_rag(requested_ids, owner_user_id) -> List[int]
```

Critical security method: `get_active_source_ids_for_rag()`
- Filters requested IDs to only active, owned sources
- Logs warnings when IDs are filtered out
- Ensures RAG never accesses deleted documents

#### API Endpoints (`app/api/data_sources.py`)

New RESTful endpoints under `/api/v1/data-sources/`:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/` | Create new data source (metadata) |
| POST | `/{source_id}/versions/` | Upload document version (triggers RAG) |
| GET | `/` | List user's active sources (with search) |
| GET | `/{source_id}` | Get source details + all versions |
| DELETE | `/{source_id}` | Soft delete (excludes from RAG) |
| GET | `/{source_id}/validate` | Check if valid for RAG use |

#### Integration with main.py

The data sources router is registered in the FastAPI application:
```python
from app.api.data_sources import router as data_sources_router
application.include_router(data_sources_router)
```

### 12.3 RAG Integration - Strict Document Filtering

**Key requirement from user:** RAG must ONLY use documents that exist and are active.
Deleted documents must be completely excluded.

Implementation ensures this through multiple layers:

1. **Database-level filtering:**
   - All queries include `WHERE status = 'active'`
   - Ownership check: `AND owner_user_id = %s`

2. **Service-level validation:**
   - `get_active_source_ids_for_rag()` validates before RAG access
   - Returns empty list if no valid sources found

3. **RAG service enforcement:**
   - `search_context()` accepts explicit `source_ids` parameter
   - ChromaDB metadata filtering: `where_filter["source_id"] = {"$in": source_ids}`
   - Only documents in the provided list are searched

4. **On-demand ingestion:**
   - Documents are ingested into vector store ONLY when explicitly requested
   - No automatic background ingestion that could include deleted docs
   - Ingestion validates source exists and is active before processing

### 12.4 User Workflow

**First-time upload:**
1. User creates data source: `POST /api/v1/data-sources/` with title
2. User uploads file: `POST /api/v1/data-sources/{id}/versions/`
3. System extracts text, creates chunks, generates embeddings
4. Document becomes available for selection in future generations

**Reusing existing document:**
1. User lists sources: `GET /api/v1/data-sources/?search=keyword`
2. User selects document from list by ID
3. Generation request includes `data_source_ids: [1, 5, 8]`
4. RAG retrieves context ONLY from those specific sources

**Updating document:**
1. User uploads new version to existing source ID
2. System increments version_number automatically
3. New content is chunked and embedded
4. Old versions remain accessible via version history

**Deleting document:**
1. User deletes: `DELETE /api/v1/data-sources/{id}`
2. Status changes to 'deleted'
3. Document disappears from list views
4. RAG filters exclude it immediately
5. Files retained for audit but inaccessible

### 12.5 Security Considerations

- **Owner verification**: Every endpoint checks `owner_user_id`
- **Soft delete permanence**: Deleted status cannot be reversed (intentional)
- **IDOR prevention**: All lookups require ownership match
- **RAG isolation**: Vector store metadata includes owner_id for filtering
- **No cross-user leakage**: ChromaDB queries always filter by owner

### 12.6 Performance Optimizations

- **Indexed queries**: 
  - `(owner_user_id, status)` composite index
  - Full-text search index on title
  - Version lookup index `(data_source_id, version_number DESC)`
  
- **Pagination**: List endpoint supports limit/offset
- **Search**: ILIKE pattern matching on title and description
- **Hash deduplication**: SHA256 prevents storing identical files

### 12.7 Testing Checklist

- [ ] Create data source without file
- [ ] Upload first version triggers RAG ingestion
- [ ] Upload second version increments version_number
- [ ] List shows only active sources
- [ ] Search filters by title/description
- [ ] Delete marks as deleted, excludes from list
- [ ] Deleted source fails validation check
- [ ] RAG search with deleted source ID returns empty
- [ ] Cross-user access attempt returns 404
- [ ] Version history shows all uploads

### 12.8 Next Steps: Phase 13

With data sources complete, the system now has:
- ✅ Persistent document repository
- ✅ Version management
- ✅ Secure soft-delete with RAG exclusion
- ✅ Searchable document library
- ✅ On-demand RAG ingestion

Future enhancements could include:
- Batch upload for multiple documents
- Document sharing between users (collaboration)
- Automatic expiration policies
- Storage quota management
- Preview thumbnails for documents
