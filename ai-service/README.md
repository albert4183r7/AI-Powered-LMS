# Lumen AI Service

Production-ready AI service for intelligent course generation with Visual RAG, multi-modal embeddings, and automated presentation creation. **Runs 100% locally using Ollama with Qwen3.6:27b - no external API keys required.**

## Features

- **Automated Module Generation**: Create complete course modules with sections and lessons
- **Visual RAG**: Multi-modal retrieval using text and image embeddings
- **Reference Document Ingestion**: Upload PDFs, Word docs, and images with automatic extraction
- **Persistent Data Sources**: Reuse uploaded documents with version control
- **Async Job Processing**: Background workers with real-time status updates
- **AI Presentation Generation**: Automatic PowerPoint (.pptx) creation
- **Lesson Regeneration**: Version comparison and rollback capabilities
- **Web Search Integration**: Real-time information via DuckDuckGo
- **Content Guardrails**: PII detection and content filtering

## Technology Stack

- **Framework**: FastAPI with Pydantic v2
- **AI Engine**: Ollama with Qwen3.6:27b (local)
- **Embeddings**: 
  - Text: `intfloat/multilingual-e5-small` (384 dims)
  - Image: `sentence-transformers/clip-ViT-B-32` (512 dims)
- **Vector Store**: ChromaDB-ready with SQLite fallback
- **Documents**: PyMuPDF (PDF), python-docx (Word), Pillow (images)
- **Presentations**: python-pptx
- **Web Search**: DuckDuckGo Search API

## Prerequisites

- **Python 3.10+**
- **Ollama** installed and running with `qwen3.6:27b` model
- **32GB+ RAM** recommended for the 27B parameter model

### Install Ollama & Model

```bash
# Install Ollama from https://ollama.ai
ollama pull qwen3.6:27b
ollama serve
```

## Quick Start

### 1. Install Dependencies

```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Configure Environment

Create `.env` file:

```dotenv
AI_SERVICE_APP_NAME="Lumen AI Service"
AI_SERVICE_ENVIRONMENT="development"
AI_SERVICE_JOBS_DATABASE_PATH="ai_jobs.db"
AI_SERVICE_WORKER_POLL_INTERVAL_SECONDS="0.2"

# Local Ollama Configuration (NO API KEY NEEDED)
AI_SERVICE_USE_REAL_MODULE_GENERATOR="true"
AI_SERVICE_QWEN_MODEL="qwen3.6:27b"
AI_SERVICE_REQUEST_TIMEOUT_SECONDS="120"

# Internal API Security
AI_SERVICE_INTERNAL_API_KEY="your-internal-api-key"

# RAG Configuration
AI_SERVICE_EMBEDDING_TEXT_MODEL="intfloat/multilingual-e5-small"
AI_SERVICE_EMBEDDING_IMAGE_MODEL="sentence-transformers/clip-ViT-B-32"
AI_SERVICE_REFERENCE_STORAGE_PATH="reference_files"
AI_SERVICE_WEB_SEARCH_ENABLED="true"
```

### 3. Run Services

**Terminal 1 - API Server:**
```bash
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 2 - Background Worker (Required):**
```bash
source venv/bin/activate
python app/jobs/worker.py
```

Verify at: `http://localhost:8000/health`

## Architecture

### Workflow

1. **Document Upload** → Text/image extraction → Embedding generation → Vector storage
2. **Job Submission** → Queue in SQLite → Worker polls → Context retrieval (RAG)
3. **AI Generation** → Ollama + Qwen3.6:27b → Structured JSON output
4. **Presentation Creation** → python-pptx → PPTX file with visuals
5. **Result Delivery** → Status polling → Download/Save to LMS

### Key Components

| Component | Description |
|-----------|-------------|
| **Ollama Provider** | Local Qwen model integration via Ollama |
| **EmbeddingService** | Multi-modal embeddings (text + images) |
| **RagService** | Hybrid retrieval with citation tracking |
| **VisualCatalog** | Image metadata extraction |
| **DataSourceService** | Document repository with versioning |
| **PresentationGenerator** | Automated PPTX creation |
| **GenerationWorker** | Async job processor |
| **WebSearchService** | DuckDuckGo integration |

## API Endpoints

### Generations
- `POST /api/v1/generations/modules` - Create module generation job
- `GET /api/v1/generations/{job_id}` - Get job status/result
- `POST /api/v1/generations/{job_id}/cancel` - Cancel job
- `POST /api/v1/generations/{job_id}/save` - Save as draft to LMS

### Data Sources
- `POST /api/v1/data-sources` - Create document source
- `POST /api/v1/data-sources/{id}/versions` - Upload new version
- `GET /api/v1/data-sources` - List user's sources
- `GET /api/v1/data-sources/{id}` - Get source details

### Lessons
- `POST /api/v1/lessons/{id}/add` - Add lesson with AI
- `POST /api/v1/lessons/{id}/regenerate` - Regenerate lesson

### Presentations
- `GET /api/v1/presentations/{job_id}/download` - Download PPTX

## Project Structure

```
ai-service/
├── app/
│   ├── main.py              # FastAPI entry point
│   ├── api/                 # REST endpoints
│   │   ├── data_sources.py  # Document repository API
│   │   ├── generations.py   # Generation jobs API
│   │   └── lessons.py       # Lesson operations API
│   ├── core/                # Core utilities
│   ├── ingestion/           # Document processing
│   ├── jobs/                # Queue system
│   │   ├── queue.py         # Job queue
│   │   └── worker.py        # Background processor
│   ├── models/              # Pydantic schemas
│   ├── providers/           # AI providers
│   │   └── qwen.py          # Ollama Qwen client
│   └── services/            # Business logic
│       ├── data_source_service.py
│       ├── embedding_service.py
│       ├── rag_service.py
│       ├── presentation_generator.py
│       └── web_search_service.py
├── reference_files/         # Uploaded documents
├── venv/                    # Python environment
└── requirements.txt         # Dependencies
```

## Development Commands

```bash
# Activate environment
source venv/bin/activate  # Windows: venv\Scripts\activate

# Run API server
uvicorn app.main:app --reload --port 8000

# Run worker (separate terminal)
python app/jobs/worker.py

# Production deployment
gunicorn app.main:app -w 4 -b 0.0.0.0:8000
```

## Performance Notes

- **First Request**: 30-60 seconds (model loading)
- **Subsequent Requests**: Much faster (model cached)
- **Embedding Generation**: Batch processed for efficiency
- **Large Documents**: Chunked with overlap for better retrieval

## Troubleshooting

### "Model not found" error
```bash
ollama pull qwen3.6:27b
```

### Slow performance
- Ensure Ollama is running (not starting up)
- Check RAM availability (27B model needs ~20GB)
- Use SSD for faster vector operations

### Worker not processing jobs
1. Verify worker is running in separate terminal
2. Check `AI_SERVICE_JOBS_DATABASE_PATH` matches API
3. Review worker logs for errors

## Security

- **Internal API Key**: Required for all requests from LMS
- **Owner Scoping**: Users can only access their own data
- **Content Filtering**: Basic guardrails enabled
- **PII Detection**: Warns on detected personal information
- **CORS**: Configured for trusted domains only

## License

Proprietary - All rights reserved
