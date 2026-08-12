# Lumen LMS

Lumen is a production-ready enterprise learning management system with integrated AI course generation capabilities. Built with Next.js, React, TypeScript, Prisma, and SQLite for the core platform, with a FastAPI-based AI service for intelligent content creation featuring Visual RAG, multi-modal embeddings, and automated presentation generation.

## Features

### Core LMS
- Email and password authentication with employee, instructor, and admin roles
- Published training catalog with category, sort, and first-letter search filters
- Course bookmarks, enrollment, sequential lessons, and completion tracking
- Instructor module management with draft and published states
- Manual lesson creation with required name, description, and 1–10 presentation attachments
- Multi-deck classroom with expandable panels and horizontal slide carousels
- Employee progress reporting for instructors
- User and role management for administrators
- Responsive English and Mandarin interface

### AI-Powered Course Generation
- **Automated Module Generation**: Create complete course modules with sections and lessons via local Qwen model (Ollama)
- **Visual RAG (Retrieval-Augmented Generation)**: Multi-modal retrieval using both text and image embeddings for accurate context
- **Reference Document Ingestion**: Upload PDFs, Word docs, and images with automatic text extraction and visual cataloging
- **Persistent Data Sources**: Reuse uploaded documents across multiple module generations with version control
- **Asynchronous Job Processing**: Background workers handle generation jobs with real-time status polling
- **Job Management**: Support for job cancellation, retry mechanisms, and draft saving
- **Multi-Language Output**: Generate content in English, Indonesian, or Mandarin
- **AI Presentation Generation**: Automatically create PowerPoint (.pptx) files with AI-selected visuals from references or generated illustrations
- **Lesson Regeneration**: Regenerate individual lessons with version comparison and rollback capabilities
- **Add Lesson with AI**: Append new AI-generated lessons to existing modules
- **Web Search Integration**: Real-time web search for up-to-date information during content generation
- **Content Guardrails**: Basic content filtering and PII detection for safety
- **100% Local & Private**: No external API calls - runs entirely on your machine with Ollama

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Client state | Zustand |
| Backend | Next.js Route Handlers + FastAPI |
| Database | SQLite with Prisma ORM |
| Validation | Zod and shared validation helpers |
| AI Engine | Ollama with Qwen3.6:27b (local, no API key) |
| Embeddings | Sentence Transformers (multilingual-e5-small, CLIP ViT-B-32) |
| Vector Store | ChromaDB-ready with local embedding storage |
| Presentations | python-pptx for PPTX generation, PDF.js previews |
| Web Search | DuckDuckGo Search API |

## Quick Start

### Prerequisites
- **Node.js 20+** & **pnpm**
- **Python 3.10+**
- **Ollama** installed with `qwen3.6:27b` model
- **32GB+ RAM** recommended for the 27B parameter model

### 1. Install Ollama & Pull Model
```bash
# Install Ollama from https://ollama.ai
ollama pull qwen3.6:27b
ollama serve
```

### 2. Install Dependencies & Setup Database
```bash
pnpm install
pnpm db:push
pnpm db:seed
```

### 3. Configure Environment Variables

**Root `.env` (LMS):**
```bash
cp .env.example .env
```
Edit `.env`:
```dotenv
DATABASE_URL="file:./db/lumen.db"
SESSION_SECRET="your-secure-session-secret"
AI_SERVICE_BASE_URL="http://localhost:8000"
# AI_SERVICE_INTERNAL_API_KEY (optional for local dev)="your-internal-api-key"
```

**AI Service `.env` (ai-service/.env):**
```bash
cd ai-service
cp .env.example .env
```
Edit `ai-service/.env`:
```dotenv
AI_SERVICE_ENVIRONMENT="development"
# AI_SERVICE_INTERNAL_API_KEY (optional for local dev)="your-internal-api-key"

# Local Ollama Configuration (NO API KEY NEEDED)
AI_SERVICE_USE_REAL_MODULE_GENERATOR="true"
AI_SERVICE_OLLAMA_MODEL="qwen3.6:27b"
AI_SERVICE_OLLAMA_REQUEST_TIMEOUT_SECONDS="120"

# RAG Configuration
AI_SERVICE_EMBEDDING_TEXT_MODEL="intfloat/multilingual-e5-small"
AI_SERVICE_EMBEDDING_IMAGE_MODEL="sentence-transformers/clip-ViT-B-32"
AI_SERVICE_REFERENCE_STORAGE_PATH="reference_files"
AI_SERVICE_WEB_SEARCH_ENABLED="true"
```

### 4. Install AI Service Python Dependencies
```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 5. Run All Services (3 Terminals Required)

**Terminal 1 - Main LMS (Next.js):**
```bash
pnpm dev
```
Runs on: `http://localhost:3000`

**Terminal 2 - AI Service API:**
```bash
cd ai-service
source venv/bin/activate
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
Runs on: `http://localhost:8000`

**Terminal 3 - AI Background Worker:**
```bash
cd ai-service
source venv/bin/activate
python app/jobs/worker.py
```
(Runs silently, polls for jobs)

### 6. Access the Application
- **LMS**: `http://localhost:3000`
- **AI API Health**: `http://localhost:8000/health`

## Environment Configuration

### Root `.env` (LMS)
```dotenv
DATABASE_URL="file:./db/lumen.db"
SESSION_SECRET="your-secure-session-secret"
AI_SERVICE_BASE_URL="http://localhost:8000"
# AI_SERVICE_INTERNAL_API_KEY (optional for local dev)="your-internal-api-key"
```

### `ai-service/.env` (AI Service)
```dotenv
AI_SERVICE_ENVIRONMENT="development"
# AI_SERVICE_INTERNAL_API_KEY (optional for local dev)="your-internal-api-key"

# Local Ollama Configuration (NO API KEY NEEDED)
AI_SERVICE_USE_REAL_MODULE_GENERATOR="true"
AI_SERVICE_OLLAMA_MODEL="qwen3.6:27b"
AI_SERVICE_OLLAMA_REQUEST_TIMEOUT_SECONDS="120"

# RAG Configuration
AI_SERVICE_EMBEDDING_TEXT_MODEL="intfloat/multilingual-e5-small"
AI_SERVICE_EMBEDDING_IMAGE_MODEL="sentence-transformers/clip-ViT-B-32"
AI_SERVICE_REFERENCE_STORAGE_PATH="reference_files"
AI_SERVICE_WEB_SEARCH_ENABLED="true"
```

> **Note:** No API key required! Everything runs locally with Ollama. Just make sure to pull the model first: `ollama pull qwen3.6:27b`

## Demo Accounts

| Role | Email | Password |
| --- | --- | --- |
| Employee | `employee@learnova.example` | `employee123` |
| Instructor | `instructor@learnova.example` | `instructor123` |
| Admin | `admin@learnova.example` | `admin123` |

## Commands

### LMS Commands
```bash
pnpm dev          # Start development server
pnpm build        # Create production build
pnpm start        # Run production server
pnpm lint         # Run ESLint
pnpm db:generate  # Regenerate Prisma client
pnpm db:push      # Apply schema changes
pnpm db:seed      # Reset and seed demo data
```

### AI Service Commands
```bash
cd ai-service
# Activate virtual environment first
source venv/bin/activate  # Windows: venv\Scripts\activate

# Development API server
uvicorn app.main:app --reload --port 8000

# Production API server
gunicorn app.main:app -w 4 -b 0.0.0.0:8000

# Background worker (required for job processing)
python app/jobs/worker.py
```

> **Important:** You must run the background worker (`worker.py`) in a separate terminal for AI generation jobs to be processed.

## Project Structure

```
lumen-lms/
├── ai-service/              # Python FastAPI AI service
│   ├── app/
│   │   ├── main.py         # FastAPI application entry point
│   │   ├── api/            # API route handlers
│   │   ├── core/           # Core business logic
│   │   ├── ingestion/      # Reference ingestion & RAG
│   │   ├── jobs/           # Job queue system
│   │   ├── models/         # Pydantic models
│   │   ├── providers/      # AI model providers (Ollama/Qwen)
│   │   ├── services/       # AI services (RAG, PPTX, Data Sources, etc.)
│   │   └── workers/        # Background job processors
│   ├── venv/               # Python virtual environment
│   ├── requirements.txt    # Python dependencies
│   └── reference_files/    # Uploaded reference documents
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── seed.ts             # Demo data seeder
├── src/
│   ├── app/                # Next.js app router
│   │   ├── api/            # API route handlers
│   │   └── uploads/        # File upload handling
│   ├── components/         # React components
│   │   ├── training/       # LMS feature components
│   │   └── ui/             # Shared UI primitives
│   ├── features/           # Domain-specific types and logic
│   ├── lib/                # Utility functions
│   ├── server/             # Server-side logic
│   │   ├── http/           # HTTP utilities
│   │   ├── services/       # Business logic services
│   │   └── validation/     # Request validation
│   └── store/              # Client state management
├── docs/                   # Documentation
├── uploads/                # Runtime file uploads
└── public/                 # Static assets
```

## API Endpoints

### Authentication
| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | User sign in |
| POST | `/api/auth/register` | User registration |
| GET | `/api/auth/me` | Get current user session |
| POST | `/api/auth/logout` | Clear user session |

### AI Generation
| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/ai/generations/modules` | Create module generation job |
| GET | `/api/ai/generations/:jobId` | Get generation job status |
| POST | `/api/ai/generations/:jobId/cancel` | Cancel generation job |
| POST | `/api/ai/generations/:jobId/save` | Save generated module as draft |

### Data Sources (Document Repository)
| Method | Endpoint | Description |
| --- | --- | --- |
| POST | `/api/ai/data-sources` | Create new data source entry |
| POST | `/api/ai/data-sources/:id/versions` | Upload new version of document |
| GET | `/api/ai/data-sources` | List user's data sources |
| GET | `/api/ai/data-sources/:id` | Get data source details |

### Lessons
| Method | Endpoint | Description |
| --- | --- | --- |
| PATCH/DELETE | `/api/lessons/:id` | Update/delete lesson |
| POST | `/api/lessons/:id/reorder` | Reorder lesson |
| POST | `/api/lessons/:id/complete` | Mark lesson complete |
| POST | `/api/ai/lessons/:id/add` | Add new lesson with AI |
| POST | `/api/ai/lessons/:id/regenerate` | Regenerate lesson with AI |

### Presentations & Uploads
| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/presentations/:id/preview` | Get PDF preview |
| POST | `/api/upload` | Upload presentation file |
| GET | `/api/ai/presentations/:jobId/download` | Download generated PPTX |

### Admin
| Method | Endpoint | Description |
| --- | --- | --- |
| GET/PATCH | `/api/admin/users` | List/update users |

## AI Service Architecture

The AI service operates as an independent FastAPI application that communicates with the main LMS via secure internal API calls. **All AI processing runs locally using Ollama with the Qwen3.6:27b model - no external API calls required.**

### Workflow

1. **Document Upload & Ingestion**: Users upload reference documents which are processed for text and images
2. **Visual RAG Processing**: Text chunks and images are embedded locally using Sentence Transformers and stored for semantic retrieval
3. **Job Submission**: LMS submits generation requests with selected data sources
4. **Context Retrieval**: RAG service retrieves relevant text passages and images from uploaded documents
5. **Web Search (Optional)**: Real-time web search augments retrieved context with current information
6. **AI Generation**: Local Qwen model via Ollama generates structured content using retrieved context + web results
7. **Presentation Creation**: Generated content is converted to PPTX with AI-selected visuals
8. **Async Processing**: Background workers process jobs with real-time status updates
9. **Result Delivery**: Generated content and presentations are returned to LMS for storage and download

### Key Components
- **Ollama Provider**: Integration with local Ollama server running `qwen3.6:27b` model
- **Embedding Service**: Local embeddings using `multilingual-e5-small` (text) and `CLIP ViT-B-32` (images)
- **RAG Service**: Hybrid text + image retrieval with citation tracking
- **Visual Catalog**: Metadata extraction for images (page, dimensions, captions)
- **Data Source Service**: Persistent document repository with versioning
- **Presentation Generator**: Automated PPTX creation with python-pptx
- **Background Worker**: Async job processing with progress tracking
- **Web Search Service**: DuckDuckGo integration for real-time information
- **Guardrails**: Content filtering and PII detection

## Documentation

- [Product Requirements](docs/product-requirements-document.md)
- [AI Product Requirements](docs/ai-product-requirements-document.md)
- [AI Implementation Guide](docs/ai-implementation-guide.md)
- [Core Architecture](docs/core-architecture.md)
- [Project Flowcharts](docs/project-flowcharts.md)
- [Coding Standards](docs/coding-standards.md)

## Production Deployment

### Environment Variables for Production

**LMS (.env):**
```dotenv
AI_SERVICE_ENVIRONMENT="production"
SESSION_SECRET="<secure-random-string>"
DATABASE_URL="file:/path/to/production.db"
AI_SERVICE_BASE_URL="http://localhost:8000"
# AI_SERVICE_INTERNAL_API_KEY (optional for local dev)="<secure-random-string>"
```

**AI Service (ai-service/.env):**
```dotenv
AI_SERVICE_ENVIRONMENT="production"
# AI_SERVICE_INTERNAL_API_KEY (optional for local dev)="<secure-random-string>"

# Local Ollama Configuration
AI_SERVICE_USE_REAL_MODULE_GENERATOR="true"
AI_SERVICE_OLLAMA_MODEL="qwen3.6:27b"
AI_SERVICE_OLLAMA_REQUEST_TIMEOUT_SECONDS="120"

# RAG Configuration
AI_SERVICE_EMBEDDING_TEXT_MODEL="intfloat/multilingual-e5-small"
AI_SERVICE_EMBEDDING_IMAGE_MODEL="sentence-transformers/clip-ViT-B-32"
AI_SERVICE_REFERENCE_STORAGE_PATH="/var/lumen/reference_files"
AI_SERVICE_WEB_SEARCH_ENABLED="true"
```

### System Requirements for Production
- **RAM**: 32GB+ recommended for Qwen3.6:27b model
- **Storage**: SSD recommended for faster model loading and vector operations
- **Ollama**: Must be running as a system service
- **Python**: 3.10+ with all dependencies installed

### Security Considerations
- Use HTTPS in production (configure reverse proxy like Nginx)
- Rotate `# AI_SERVICE_INTERNAL_API_KEY (optional for local dev)` regularly
- Implement rate limiting at the reverse proxy level
- Enable CORS only for trusted domains
- Store secrets in environment variables or secret management systems
- Content guardrails for PII and harmful content detection
- Correlation ID logging for observability and debugging
- Run Ollama as a dedicated user with limited permissions

## License

Proprietary - All rights reserved
