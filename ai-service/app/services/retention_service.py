"""
Retention Policy Automation Service.
Implements automatic cleanup of old jobs, prompts, files, and embeddings.
PRD Section 18: Data, penyimpanan, dan retention.
"""
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Tuple

logger = logging.getLogger(__name__)


class RetentionPolicyService:
    """
    Automated cleanup service for AI service data.
    
    Retention periods (configurable):
    - Job metadata: 30 days after completion
    - Prompts: 30 days (encrypted if available)
    - Temporary reference files: 7 days after job completion
    - Generated artifacts: 7 days after save or job expiry
    - Operational logs: 30 days without full prompts
    """
    
    def __init__(
        self,
        job_retention_days: int = 30,
        prompt_retention_days: int = 30,
        file_cleanup_days: int = 7,
        embedding_retention_days: int = 30,
    ):
        self.job_retention_days = job_retention_days
        self.prompt_retention_days = prompt_retention_days
        self.file_cleanup_days = file_cleanup_days
        self.embedding_retention_days = embedding_retention_days
        
    async def cleanup_expired_jobs(self, db_connection) -> Tuple[int, int]:
        """
        Remove job metadata older than retention period.
        
        Returns:
            Tuple of (jobs_marked_for_deletion, jobs_deleted)
        """
        cutoff_date = datetime.utcnow() - timedelta(days=self.job_retention_days)
        
        try:
            cursor = db_connection.cursor()
            
            # Mark old completed/failed/cancelled jobs for deletion
            cursor.execute("""
                UPDATE generation_jobs 
                SET status = 'expired'
                WHERE status IN ('completed', 'failed', 'cancelled')
                AND created_at < ?
                AND status != 'expired'
            """, (cutoff_date.isoformat(),))
            
            marked_count = cursor.rowcount
            
            # Actually delete expired jobs (older than additional grace period)
            grace_cutoff = cutoff_date - timedelta(days=7)
            cursor.execute("""
                DELETE FROM generation_jobs
                WHERE status = 'expired'
                AND updated_at < ?
            """, (grace_cutoff.isoformat(),))
            
            deleted_count = cursor.rowcount
            db_connection.commit()
            
            if marked_count > 0 or deleted_count > 0:
                logger.info(
                    "Retention cleanup: marked %d jobs as expired, deleted %d old expired jobs",
                    marked_count,
                    deleted_count
                )
            
            return (marked_count, deleted_count)
            
        except Exception as e:
            logger.error("Failed to cleanup expired jobs: %s", str(e))
            raise
    
    async def cleanup_old_prompts(self, db_connection) -> int:
        """
        Remove prompt data older than retention period.
        Prompts are stored encrypted if available.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=self.prompt_retention_days)
        
        try:
            cursor = db_connection.cursor()
            
            # Delete old prompt records
            cursor.execute("""
                DELETE FROM generation_prompts
                WHERE created_at < ?
            """, (cutoff_date.isoformat(),))
            
            deleted_count = cursor.rowcount
            db_connection.commit()
            
            if deleted_count > 0:
                logger.info("Retention cleanup: deleted %d old prompt records", deleted_count)
            
            return deleted_count
            
        except Exception as e:
            logger.error("Failed to cleanup old prompts: %s", str(e))
            raise
    
    async def cleanup_temporary_files(
        self, 
        storage_path: Path, 
        db_connection
    ) -> Tuple[int, int]:
        """
        Remove temporary reference files and generated artifacts.
        
        Returns:
            Tuple of (files_deleted, total_bytes_freed)
        """
        cutoff_date = datetime.utcnow() - timedelta(days=self.file_cleanup_days)
        files_deleted = 0
        bytes_freed = 0
        
        try:
            cursor = db_connection.cursor()
            
            # Get list of temporary files to delete
            cursor.execute("""
                SELECT id, file_path, file_size
                FROM reference_files
                WHERE is_temporary = 1
                AND created_at < ?
            """, (cutoff_date.isoformat(),))
            
            files_to_delete = cursor.fetchall()
            
            for file_id, file_path, file_size in files_to_delete:
                try:
                    # Delete physical file
                    path = Path(file_path)
                    if path.exists():
                        actual_size = path.stat().st_size
                        path.unlink()
                        files_deleted += 1
                        bytes_freed += actual_size
                    
                    # Remove database record
                    cursor.execute("DELETE FROM reference_files WHERE id = ?", (file_id,))
                    
                except Exception as e:
                    logger.warning("Failed to delete temporary file %s: %s", file_path, str(e))
            
            db_connection.commit()
            
            if files_deleted > 0:
                logger.info(
                    "Retention cleanup: deleted %d temporary files, freed %.2f MB",
                    files_deleted,
                    bytes_freed / (1024 * 1024)
                )
            
            return (files_deleted, bytes_freed)
            
        except Exception as e:
            logger.error("Failed to cleanup temporary files: %s", str(e))
            raise
    
    async def cleanup_orphaned_embeddings(self, chroma_client, db_connection) -> int:
        """
        Remove embeddings for deleted references.
        Ensures vector store stays in sync with database.
        """
        try:
            cursor = db_connection.cursor()
            
            # Get all active reference IDs
            cursor.execute("""
                SELECT DISTINCT reference_id 
                FROM text_chunks 
                WHERE reference_id IS NOT NULL
            """)
            
            active_refs = {row[0] for row in cursor.fetchall()}
            
            # In production, would query ChromaDB for all IDs and compare
            # For now, log the operation
            logger.info(
                "Embedding cleanup: found %d active references with embeddings",
                len(active_refs)
            )
            
            # TODO: Implement ChromaDB collection cleanup
            # collection = chroma_client.get_collection(name="references")
            # Delete embeddings where metadata.reference_id not in active_refs
            
            return 0  # Placeholder
            
        except Exception as e:
            logger.error("Failed to cleanup orphaned embeddings: %s", str(e))
            raise
    
    async def run_full_cleanup_cycle(
        self,
        db_connection,
        storage_path: Path,
        chroma_client=None
    ) -> dict:
        """
        Execute complete retention cleanup cycle.
        Should be scheduled to run daily during low-traffic hours.
        
        Returns:
            Dictionary with cleanup statistics
        """
        logger.info("Starting retention policy cleanup cycle")
        
        stats = {
            "jobs_marked": 0,
            "jobs_deleted": 0,
            "prompts_deleted": 0,
            "files_deleted": 0,
            "bytes_freed": 0,
            "embeddings_cleaned": 0,
        }
        
        try:
            # Cleanup jobs
            jobs_marked, jobs_deleted = await self.cleanup_expired_jobs(db_connection)
            stats["jobs_marked"] = jobs_marked
            stats["jobs_deleted"] = jobs_deleted
            
            # Cleanup prompts
            prompts_deleted = await self.cleanup_old_prompts(db_connection)
            stats["prompts_deleted"] = prompts_deleted
            
            # Cleanup temporary files
            files_deleted, bytes_freed = await self.cleanup_temporary_files(
                storage_path, db_connection
            )
            stats["files_deleted"] = files_deleted
            stats["bytes_freed"] = bytes_freed
            
            # Cleanup embeddings
            if chroma_client:
                embeddings_cleaned = await self.cleanup_orphaned_embeddings(
                    chroma_client, db_connection
                )
                stats["embeddings_cleaned"] = embeddings_cleaned
            
            logger.info(
                "Retention cleanup cycle completed: %s",
                stats
            )
            
            return stats
            
        except Exception as e:
            logger.error("Retention cleanup cycle failed: %s", str(e))
            raise


# Singleton instance with default retention periods
retention_service = RetentionPolicyService(
    job_retention_days=30,
    prompt_retention_days=30,
    file_cleanup_days=7,
    embedding_retention_days=30,
)
