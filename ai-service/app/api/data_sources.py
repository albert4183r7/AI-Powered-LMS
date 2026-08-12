"""
Data Sources API Endpoints
Manage reusable document repository for module generation.
"""

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Query
from typing import List, Optional
import logging

from app.database.database import Database, get_db
from app.services.data_source_service import DataSourceService
from app.services.rag_service import RagService
from app.services.embedding_service import EmbeddingService
from app.ingestion.reference_repository import ReferenceRepository
from app.api.generations import get_current_user_id

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/data-sources", tags=["data-sources"])


def get_data_source_service(db: Database) -> DataSourceService:
    """Get DataSourceService instance with dependencies."""
    # These would be initialized in main.py and passed via dependency injection
    # For now, creating minimal instances
    embedding_service = None  # Would be injected from app state
    ref_repo = ReferenceRepository(db)
    rag_service = None  # Would be injected from app state
    
    return DataSourceService(db, rag_service)


@router.post("/", summary="Create a new data source")
async def create_data_source(
    title: str = Form(...),
    description: Optional[str] = Form(None),
    db: Database = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """
    Create a new data source entry (metadata only).
    After creation, upload a document version using POST /{source_id}/versions/
    """
    service = get_data_source_service(db)
    
    try:
        source_id = await service.create_data_source(
            title=title,
            description=description,
            owner_user_id=current_user_id
        )
        
        return {
            "id": source_id,
            "title": title,
            "description": description,
            "message": "Data source created. Upload a document version next."
        }
    except Exception as e:
        logger.error(f"Failed to create data source: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{source_id}/versions/", summary="Upload a document version")
async def upload_document_version(
    source_id: int,
    file: UploadFile = File(...),
    db: Database = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """
    Upload a new version of a document to an existing data source.
    This triggers RAG ingestion automatically if the service is available.
    """
    import os
    import shutil
    from datetime import datetime
    
    service = get_data_source_service(db)
    
    # Verify source exists and is accessible
    source = await service.get_data_source(source_id, current_user_id)
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found or not accessible")
    
    # Save uploaded file
    upload_dir = f"uploads/data_sources/{current_user_id}/{source_id}"
    os.makedirs(upload_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_filename = f"{timestamp}_{file.filename}"
    file_path = os.path.join(upload_dir, safe_filename)
    
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        file_size = os.path.getsize(file_path)
        
        # TODO: Extract text content from file (PDF, DOCX, etc.)
        # For now, setting to None - would integrate with reference ingestion logic
        text_content = None
        
        version_id = await service.upload_document_version(
            data_source_id=source_id,
            file_path=file_path,
            file_size=file_size,
            mime_type=file.content_type or "application/octet-stream",
            original_filename=file.filename,
            owner_user_id=current_user_id,
            text_content=text_content
        )
        
        return {
            "version_id": version_id,
            "data_source_id": source_id,
            "filename": file.filename,
            "file_size": file_size,
            "message": "Document version uploaded successfully"
        }
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to upload document version: {e}")
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/", summary="List all data sources")
async def list_data_sources(
    search: Optional[str] = Query(None, description="Search in title and description"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Database = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """
    List all active data sources for the current user.
    Deleted sources are excluded.
    """
    service = get_data_source_service(db)
    
    sources = await service.list_data_sources(
        owner_user_id=current_user_id,
        search_query=search,
        limit=limit,
        offset=offset
    )
    
    return {
        "count": len(sources),
        "limit": limit,
        "offset": offset,
        "sources": sources
    }


@router.get("/{source_id}", summary="Get data source details")
async def get_data_source_details(
    source_id: int,
    db: Database = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """
    Get detailed information about a specific data source including latest version.
    Only returns active sources.
    """
    service = get_data_source_service(db)
    
    source = await service.get_data_source(source_id, current_user_id)
    if not source:
        raise HTTPException(status_code=404, detail="Data source not found or not accessible")
    
    # Get all versions
    versions = await service.get_data_source_versions(source_id, current_user_id)
    
    return {
        "source": source,
        "versions": versions
    }


@router.delete("/{source_id}", summary="Delete a data source")
async def delete_data_source(
    source_id: int,
    db: Database = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """
    Soft delete a data source.
    The source will be marked as deleted and excluded from all future operations including RAG.
    """
    service = get_data_source_service(db)
    
    success = await service.delete_data_source(source_id, current_user_id)
    if not success:
        raise HTTPException(status_code=404, detail="Data source not found or not accessible")
    
    return {"message": f"Data source {source_id} has been deleted"}


@router.get("/{source_id}/validate", summary="Validate data source for RAG")
async def validate_data_source_for_rag(
    source_id: int,
    db: Database = Depends(get_db),
    current_user_id: int = Depends(get_current_user_id)
):
    """
    Check if a data source is valid and active for use in RAG.
    Returns validation status and any issues.
    """
    service = get_data_source_service(db)
    
    source = await service.get_data_source(source_id, current_user_id)
    
    if not source:
        return {
            "valid": False,
            "reason": "Data source not found, not accessible, or deleted"
        }
    
    # Check if it has a file
    if not source.get('file_path'):
        return {
            "valid": False,
            "reason": "No document version uploaded yet"
        }
    
    return {
        "valid": True,
        "source_id": source_id,
        "title": source['title'],
        "filename": source.get('original_filename'),
        "status": source['status']
    }
