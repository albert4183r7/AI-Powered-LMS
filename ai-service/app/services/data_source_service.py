"""
Data Source Service
Manages persistent document repository for reuse across module generations.
Users can upload documents once and reuse them multiple times.
Only active (non-deleted) documents are available for RAG retrieval.
"""

import logging
from typing import List, Optional, Dict, Any
from datetime import datetime
import hashlib

from app.database.database import Database
from app.services.rag_service import RagService

logger = logging.getLogger(__name__)


class DataSourceService:
    """
    Service for managing reusable document sources.
    Documents are stored once and can be referenced multiple times.
    Deleted documents are excluded from all operations.
    """
    
    def __init__(self, db: Database, rag_service: Optional[RagService] = None):
        self.db = db
        self.rag_service = rag_service
    
    async def create_data_source(
        self,
        title: str,
        description: Optional[str],
        owner_user_id: int
    ) -> int:
        """
        Create a new data source entry (metadata only).
        Returns the data source ID.
        """
        query = """
            INSERT INTO data_sources (title, description, owner_user_id, status, created_at)
            VALUES (%s, %s, %s, 'active', NOW())
            RETURNING id
        """
        result = await self.db.fetch_row(
            query,
            title,
            description,
            owner_user_id
        )
        
        if not result:
            raise ValueError("Failed to create data source")
        
        return result['id']
    
    async def upload_document_version(
        self,
        data_source_id: int,
        file_path: str,
        file_size: int,
        mime_type: str,
        original_filename: str,
        owner_user_id: int,
        text_content: Optional[str] = None,
        extract_images: bool = True
    ) -> int:
        """
        Upload a new version of a document to an existing data source.
        Automatically triggers RAG ingestion if enabled.
        
        Returns the version ID.
        """
        # Verify ownership and active status
        source = await self.get_data_source(data_source_id, owner_user_id)
        if not source:
            raise ValueError(f"Data source {data_source_id} not found or not accessible")
        
        if source['status'] != 'active':
            raise ValueError(f"Data source {data_source_id} is not active")
        
        # Calculate file hash for deduplication
        file_hash = self._calculate_file_hash(file_path)
        
        # Create new version
        version_query = """
            INSERT INTO data_source_versions 
            (data_source_id, file_path, file_size, mime_type, original_filename, file_hash, version_number, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, 
                    (SELECT COALESCE(MAX(version_number), 0) + 1 FROM data_source_versions WHERE data_source_id = %s),
                    NOW())
            RETURNING id
        """
        result = await self.db.fetch_row(
            version_query,
            data_source_id,
            file_path,
            file_size,
            mime_type,
            original_filename,
            file_hash,
            data_source_id
        )
        
        if not result:
            raise ValueError("Failed to create document version")
        
        version_id = result['id']
        
        # Update latest_version_id in data_sources
        await self.db.execute(
            "UPDATE data_sources SET latest_version_id = %s, updated_at = NOW() WHERE id = %s",
            version_id,
            data_source_id
        )
        
        # Trigger RAG ingestion if text content provided
        if text_content and self.rag_service:
            try:
                await self.rag_service.ingest_reference_chunks(
                    reference_id=data_source_id,  # Use data_source_id as reference_id
                    owner_user_id=owner_user_id,
                    text_content=text_content
                )
                logger.info(f"RAG ingestion completed for data source {data_source_id}")
            except Exception as e:
                logger.error(f"RAG ingestion failed for data source {data_source_id}: {e}")
                # Continue even if RAG fails
        
        return version_id
    
    async def list_data_sources(
        self,
        owner_user_id: int,
        search_query: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        List all active data sources for a user.
        Optionally filter by search query.
        Only returns active (non-deleted) sources.
        """
        query = """
            SELECT 
                ds.id,
                ds.title,
                ds.description,
                ds.status,
                ds.latest_version_id,
                ds.created_at,
                ds.updated_at,
                dsv.file_path,
                dsv.original_filename,
                dsv.file_size,
                dsv.mime_type,
                dsv.version_number
            FROM data_sources ds
            LEFT JOIN data_source_versions dsv ON ds.latest_version_id = dsv.id
            WHERE ds.owner_user_id = %s 
              AND ds.status = 'active'
        """
        params = [owner_user_id]
        
        if search_query:
            query += " AND (ds.title ILIKE %s OR ds.description ILIKE %s)"
            search_pattern = f"%{search_query}%"
            params.extend([search_pattern, search_pattern])
        
        query += " ORDER BY ds.updated_at DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        
        rows = await self.db.fetch_all(query, *params)
        
        return [dict(row) for row in rows]
    
    async def get_data_source(
        self,
        data_source_id: int,
        owner_user_id: int
    ) -> Optional[Dict[str, Any]]:
        """
        Get details of a specific data source.
        Only returns if source is active and owned by user.
        """
        query = """
            SELECT 
                ds.*,
                dsv.file_path,
                dsv.original_filename,
                dsv.file_size,
                dsv.mime_type,
                dsv.version_number,
                dsv.file_hash
            FROM data_sources ds
            LEFT JOIN data_source_versions dsv ON ds.latest_version_id = dsv.id
            WHERE ds.id = %s 
              AND ds.owner_user_id = %s
              AND ds.status = 'active'
        """
        row = await self.db.fetch_row(query, data_source_id, owner_user_id)
        
        return dict(row) if row else None
    
    async def get_data_source_versions(
        self,
        data_source_id: int,
        owner_user_id: int
    ) -> List[Dict[str, Any]]:
        """
        Get all versions of a data source.
        """
        # First verify ownership and active status
        source = await self.get_data_source(data_source_id, owner_user_id)
        if not source:
            return []
        
        query = """
            SELECT id, version_number, file_path, original_filename, file_size, 
                   mime_type, file_hash, created_at
            FROM data_source_versions
            WHERE data_source_id = %s
            ORDER BY version_number DESC
        """
        rows = await self.db.fetch_all(query, data_source_id)
        
        return [dict(row) for row in rows]
    
    async def delete_data_source(
        self,
        data_source_id: int,
        owner_user_id: int
    ) -> bool:
        """
        Soft delete a data source.
        This marks it as deleted, making it unavailable for selection and RAG.
        Files are kept for audit but marked inactive.
        """
        # Verify ownership
        source = await self.get_data_source(data_source_id, owner_user_id)
        if not source:
            return False
        
        # Soft delete - update status
        await self.db.execute(
            "UPDATE data_sources SET status = 'deleted', updated_at = NOW() WHERE id = %s",
            data_source_id
        )
        
        logger.info(f"Data source {data_source_id} marked as deleted")
        return True
    
    async def get_active_source_ids_for_rag(
        self,
        requested_ids: List[int],
        owner_user_id: int
    ) -> List[int]:
        """
        Filter requested IDs to only include active, accessible data sources.
        This ensures RAG only uses valid documents.
        
        Args:
            requested_ids: List of data source IDs requested by user
            owner_user_id: User ID for ownership verification
            
        Returns:
            List of valid, active data source IDs
        """
        if not requested_ids:
            return []
        
        placeholders = ','.join(['%s'] * len(requested_ids))
        query = f"""
            SELECT id FROM data_sources
            WHERE id IN ({placeholders})
              AND owner_user_id = %s
              AND status = 'active'
        """
        params = requested_ids + [owner_user_id]
        
        rows = await self.db.fetch_all(query, *params)
        valid_ids = [row['id'] for row in rows]
        
        # Log if any IDs were filtered out
        if len(valid_ids) < len(requested_ids):
            filtered = set(requested_ids) - set(valid_ids)
            logger.warning(f"Filtered out {len(filtered)} invalid/deleted data source IDs: {filtered}")
        
        return valid_ids
    
    def _calculate_file_hash(self, file_path: str) -> str:
        """Calculate SHA256 hash of a file."""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
