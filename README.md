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
- **Automated Module Generation**: Create complete course modules with sections and lessons via Qwen API integration
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

## Technology Stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Client state | Zustand |
| Backend | Next.js Route Handlers + FastAPI |
| Database | SQLite with Prisma ORM |
| Validation | Zod and shared validation helpers |
| AI Service | Python FastAPI with Qwen API integration |
| Embeddings | Sentence Transformers (multilingual-e5-small, CLIP ViT-B-32) |
| Vector Store | ChromaDB-ready with local embedding storage |
| Presentations | python-pptx for PPTX generation, PDF.js previews |
| Web Search | DuckDuckGo Search API |

## Quick Start

### Prerequisites
- Node.js 20 or newer
- Python 3.10+
- pnpm

### Installation

1. **Install dependencies:**
   ```bash
   pnpm install
   ```

2. **Set up environment variables:**
   - Copy `.env.example` to `.env` in the root directory
   - Configure AI service variables in `ai-service/.env`

3. **Initialize database:**
   ```bash
   pnpm db:push
   pnpm db:seed
   ```

4. **Start development servers:**
   
   **Terminal 1 - Main LMS:**
   ```bash
   pnpm dev
   ```
   
   **Terminal 2 - AI Service:**
   ```bash
   cd ai-service
   python -m uvicorn app.main:app --reload --port 8000
   ```

5. **Access the application:**
   - LMS: `http://localhost:3000`
   - AI API: `http://localhost:8000`

## Environment Configuration

### Root `.env` (LMS)
```dotenv
DATABASE_URL="file:./db/lumen.db"
SESSION_SECRET="your-secure-session-secret"
AI_SERVICE_BASE_URL="http://localhost:8000"
AI_SERVICE_INTERNAL_API_KEY="your-internal-api-key"
```

### `ai-service/.env` (AI Service)
```dotenv
AI_SERVICE_ENVIRONMENT="development"
AI_SERVICE_INTERNAL_API_KEY="your-internal-api-key"
QWEN_API_KEY="your-qwen-api-key"
QWEN_BASE_URL="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
QWEN_MODEL="qwen-plus"
```

> **Security Note:** Use long, random values for secrets in production. The `AI_SERVICE_INTERNAL_API_KEY` must match in both services.

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
python -m uvicorn app.main:app --reload --port 8000  # Development
python -m gunicorn app.main:app -w 4 -b 0.0.0.0:8000  # Production
```

## Project Structure

```
lumen-lms/
├── ai-service/              # Python FastAPI AI service
│   ├── app/
│   │   ├── main.py         # FastAPI application entry point
│   │   ├── api/            # API route handlers
│   │   ├── core/           # Core business logic
│   │   ├── ingestion/      # Reference ingestion & RAG
│   │   ├── models/         # Pydantic models
│   │   └── services/       # AI services (Qwen, RAG, PPTX, etc.)
│   └── requirements.txt    # Python dependencies
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

The AI service operates as an independent FastAPI application that communicates with the main LMS via secure internal API calls:

1. **Document Upload & Ingestion**: Users upload reference documents which are processed for text and images
2. **Visual RAG Processing**: Text chunks and images are embedded locally and stored for semantic retrieval
3. **Job Submission**: LMS submits generation requests with selected data sources
4. **Context Retrieval**: RAG service retrieves relevant text passages and images from uploaded documents
5. **Web Search (Optional)**: Real-time web search augments retrieved context with current information
6. **AI Generation**: Qwen API generates structured content using retrieved context + web results
7. **Presentation Creation**: Generated content is converted to PPTX with AI-selected visuals
8. **Async Processing**: Background workers process jobs with real-time status updates
9. **Result Delivery**: Generated content and presentations are returned to LMS for storage and download

### Key Components
- **Qwen Provider**: Integration with Qwen API (`qwen-plus` model) for text generation
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
```dotenv
# LMS
AI_SERVICE_ENVIRONMENT="production"
SESSION_SECRET="<secure-random-string>"
DATABASE_URL="file:/path/to/production.db"

# AI Service
AI_SERVICE_ENVIRONMENT="production"
AI_SERVICE_INTERNAL_API_KEY="<secure-random-string>"
QWEN_API_KEY="<your-qwen-production-key>"
QWEN_BASE_URL="https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
QWEN_MODEL="qwen-plus"
```

### Security Considerations
- Use HTTPS in production
- Rotate API keys regularly
- Implement rate limiting
- Enable CORS only for trusted domains
- Store secrets in environment variables or secret management systems
- Content guardrails for PII and harmful content detection
- Correlation ID logging for observability and debugging

## License

Proprietary - All rights reserved
