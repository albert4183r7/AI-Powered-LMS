"""SQLite persistence for reference files and extracted images."""

import sqlite3
from dataclasses import dataclass
from datetime import timezone, datetime
from pathlib import Path

SQLITE_CONNECTION_TIMEOUT_SECONDS = 5


@dataclass(frozen=True)
class StoredReferenceFile:
    """Internal database representation of one ingested reference."""

    file_id: str
    owner_user_id: str
    original_filename: str
    content_type: str
    size_bytes: int
    storage_path: str
    extracted_text_path: str | None
    extracted_text_length: int
    extracted_image_count: int
    created_at: datetime


@dataclass(frozen=True)
class StoredExtractedImage:
    """Internal database representation of one extracted image."""

    image_id: str
    file_id: str
    source_page: int
    width: int
    height: int
    format: str
    storage_path: str
    created_at: datetime


@dataclass(frozen=True)
class StoredTextChunk:
    """Internal database representation of one text chunk for RAG."""

    chunk_id: str
    file_id: str
    chunk_index: int
    text_content: str
    source_page: int | None
    embedding_type: str  # "text" or "image"
    embedding_vector: list[float] | None
    created_at: datetime


@dataclass(frozen=True)
class StoredImageEmbedding:
    """Internal database representation of one image embedding for Visual RAG."""

    image_id: str
    file_id: str
    source_page: int
    storage_path: str
    embedding_vector: list[float] | None
    caption: str | None
    created_at: datetime


class ReferenceRepository:
    """Store and retrieve reference file metadata in the AI jobs database."""

    def __init__(self, database_path: Path) -> None:
        self._database_path = database_path

    def initialize_tables(self) -> None:
        """Create reference tables when the service starts for the first time."""

        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS reference_files (
                    file_id TEXT PRIMARY KEY,
                    owner_user_id TEXT NOT NULL,
                    original_filename TEXT NOT NULL,
                    content_type TEXT NOT NULL,
                    size_bytes INTEGER NOT NULL,
                    storage_path TEXT NOT NULL,
                    extracted_text_path TEXT,
                    extracted_text_length INTEGER NOT NULL DEFAULT 0,
                    extracted_image_count INTEGER NOT NULL DEFAULT 0,
                    created_at TEXT NOT NULL
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS reference_files_owner_index
                ON reference_files (owner_user_id, file_id)
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS extracted_images (
                    image_id TEXT PRIMARY KEY,
                    file_id TEXT NOT NULL,
                    source_page INTEGER NOT NULL,
                    width INTEGER NOT NULL,
                    height INTEGER NOT NULL,
                    format TEXT NOT NULL,
                    storage_path TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (file_id) REFERENCES reference_files (file_id)
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS extracted_images_file_index
                ON extracted_images (file_id)
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS text_chunks (
                    chunk_id TEXT PRIMARY KEY,
                    file_id TEXT NOT NULL,
                    chunk_index INTEGER NOT NULL,
                    text_content TEXT NOT NULL,
                    source_page INTEGER,
                    embedding_type TEXT NOT NULL DEFAULT 'text',
                    embedding_vector BLOB,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (file_id) REFERENCES reference_files (file_id)
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS text_chunks_file_index
                ON text_chunks (file_id)
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS text_chunks_type_index
                ON text_chunks (embedding_type)
                """
            )
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS image_embeddings (
                    image_id TEXT PRIMARY KEY,
                    file_id TEXT NOT NULL,
                    source_page INTEGER NOT NULL,
                    storage_path TEXT NOT NULL,
                    embedding_vector BLOB,
                    caption TEXT,
                    created_at TEXT NOT NULL,
                    FOREIGN KEY (file_id) REFERENCES reference_files (file_id)
                )
                """
            )
            connection.execute(
                """
                CREATE INDEX IF NOT EXISTS image_embeddings_file_index
                ON image_embeddings (file_id)
                """
            )

    def store_reference_file(
        self,
        *,
        file_id: str,
        owner_user_id: str,
        original_filename: str,
        content_type: str,
        size_bytes: int,
        storage_path: str,
        extracted_text_path: str | None,
        extracted_text_length: int,
        extracted_image_count: int,
    ) -> StoredReferenceFile:
        """Persist metadata for a validated and ingested reference file."""

        created_at = self._now()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO reference_files (
                    file_id, owner_user_id, original_filename, content_type,
                    size_bytes, storage_path, extracted_text_path,
                    extracted_text_length, extracted_image_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    file_id,
                    owner_user_id,
                    original_filename,
                    content_type,
                    size_bytes,
                    storage_path,
                    extracted_text_path,
                    extracted_text_length,
                    extracted_image_count,
                    created_at,
                ),
            )
        return StoredReferenceFile(
            file_id=file_id,
            owner_user_id=owner_user_id,
            original_filename=original_filename,
            content_type=content_type,
            size_bytes=size_bytes,
            storage_path=storage_path,
            extracted_text_path=extracted_text_path,
            extracted_text_length=extracted_text_length,
            extracted_image_count=extracted_image_count,
            created_at=datetime.fromisoformat(created_at),
        )

    def store_extracted_image(
        self,
        *,
        image_id: str,
        file_id: str,
        source_page: int,
        width: int,
        height: int,
        image_format: str,
        storage_path: str,
    ) -> None:
        """Persist metadata for one image extracted from a reference."""

        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO extracted_images (
                    image_id, file_id, source_page, width, height,
                    format, storage_path, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    image_id,
                    file_id,
                    source_page,
                    width,
                    height,
                    image_format,
                    storage_path,
                    self._now(),
                ),
            )

    def get_reference_file_for_owner(
        self,
        file_id: str,
        owner_user_id: str,
    ) -> StoredReferenceFile | None:
        """Return a reference file only when it belongs to the authenticated user."""

        with self._connect() as connection:
            row = connection.execute(
                "SELECT * FROM reference_files WHERE file_id = ? AND owner_user_id = ?",
                (file_id, owner_user_id),
            ).fetchone()
        return self._map_reference_row(row) if row else None

    def get_reference_files_by_ids_for_owner(
        self,
        file_ids: list[str],
        owner_user_id: str,
    ) -> list[StoredReferenceFile]:
        """Return only the files that exist and belong to the given owner."""

        if not file_ids:
            return []
        placeholders = ",".join("?" for _ in file_ids)
        with self._connect() as connection:
            rows = connection.execute(
                f"""
                SELECT * FROM reference_files
                WHERE file_id IN ({placeholders}) AND owner_user_id = ?
                """,
                [*file_ids, owner_user_id],
            ).fetchall()
        return [self._map_reference_row(row) for row in rows]

    def get_extracted_images_for_file(
        self,
        file_id: str,
        owner_user_id: str,
    ) -> list[StoredExtractedImage]:
        """Return images only when the parent file belongs to the owner."""

        reference = self.get_reference_file_for_owner(file_id, owner_user_id)
        if reference is None:
            return []
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM extracted_images WHERE file_id = ?",
                (file_id,),
            ).fetchall()
        return [self._map_image_row(row) for row in rows]

    def delete_reference_file(
        self,
        file_id: str,
        owner_user_id: str,
    ) -> bool:
        """Delete a reference and its images, returning True if the file existed."""

        with self._connect() as connection:
            connection.execute("BEGIN IMMEDIATE")
            result = connection.execute(
                "DELETE FROM reference_files WHERE file_id = ? AND owner_user_id = ?",
                (file_id, owner_user_id),
            )
            if result.rowcount == 0:
                connection.commit()
                return False
            connection.execute(
                "DELETE FROM extracted_images WHERE file_id = ?",
                (file_id,),
            )
            connection.commit()
        return True

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(
            self._database_path,
            timeout=SQLITE_CONNECTION_TIMEOUT_SECONDS,
        )
        connection.row_factory = sqlite3.Row
        return connection

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _map_reference_row(row: sqlite3.Row) -> StoredReferenceFile:
        return StoredReferenceFile(
            file_id=row["file_id"],
            owner_user_id=row["owner_user_id"],
            original_filename=row["original_filename"],
            content_type=row["content_type"],
            size_bytes=row["size_bytes"],
            storage_path=row["storage_path"],
            extracted_text_path=row["extracted_text_path"],
            extracted_text_length=row["extracted_text_length"],
            extracted_image_count=row["extracted_image_count"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    @staticmethod
    def _map_image_row(row: sqlite3.Row) -> StoredExtractedImage:
        return StoredExtractedImage(
            image_id=row["image_id"],
            file_id=row["file_id"],
            source_page=row["source_page"],
            width=row["width"],
            height=row["height"],
            format=row["format"],
            storage_path=row["storage_path"],
            created_at=datetime.fromisoformat(row["created_at"]),
        )

    def store_text_chunks(
        self,
        chunks: list[tuple[str, str, int, str, int | None]],
        embedding_type: str = "text",
    ) -> list[StoredTextChunk]:
        """Persist text chunks with optional embeddings for a reference file.
        
        Args:
            chunks: List of tuples (chunk_id, file_id, chunk_index, text_content, source_page).
            embedding_type: Type of embedding ("text" or "image").
            
        Returns:
            List of stored text chunk records.
        """
        if not chunks:
            return []
        
        created_at = self._now()
        stored_chunks = []
        with self._connect() as connection:
            for chunk_id, file_id, chunk_index, text_content, source_page in chunks:
                connection.execute(
                    """
                    INSERT INTO text_chunks (
                        chunk_id, file_id, chunk_index, text_content,
                        source_page, embedding_type, embedding_vector, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
                    """,
                    (chunk_id, file_id, chunk_index, text_content, source_page, embedding_type, created_at),
                )
                stored_chunks.append(
                    StoredTextChunk(
                        chunk_id=chunk_id,
                        file_id=file_id,
                        chunk_index=chunk_index,
                        text_content=text_content,
                        source_page=source_page,
                        embedding_type=embedding_type,
                        embedding_vector=None,
                        created_at=datetime.fromisoformat(created_at),
                    )
                )
        return stored_chunks

    def store_image_embedding(
        self,
        *,
        image_id: str,
        file_id: str,
        source_page: int,
        storage_path: str,
        embedding_vector: list[float] | None = None,
        caption: str | None = None,
    ) -> StoredImageEmbedding | None:
        """Persist an image embedding for Visual RAG.
        
        Args:
            image_id: Unique identifier for the image.
            file_id: Parent reference file ID.
            source_page: Page/slide number where image was found.
            storage_path: File path to the stored image.
            embedding_vector: CLIP embedding vector for the image.
            caption: Optional AI-generated caption for the image.
            
        Returns:
            Stored image embedding record, or None if failed.
        """
        created_at = self._now()
        import pickle
        
        embedding_blob = pickle.dumps(embedding_vector) if embedding_vector else None
        
        try:
            with self._connect() as connection:
                connection.execute(
                    """
                    INSERT INTO image_embeddings (
                        image_id, file_id, source_page, storage_path,
                        embedding_vector, caption, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (image_id, file_id, source_page, storage_path, embedding_blob, caption, created_at),
                )
            return StoredImageEmbedding(
                image_id=image_id,
                file_id=file_id,
                source_page=source_page,
                storage_path=storage_path,
                embedding_vector=embedding_vector,
                caption=caption,
                created_at=datetime.fromisoformat(created_at),
            )
        except Exception as e:
            LOGGER.error("Failed to store image embedding %s: %s", image_id, e)
            return None

    def update_chunk_embedding(
        self,
        chunk_id: str,
        file_id: str,
        owner_user_id: str,
        embedding_vector: list[float],
    ) -> bool:
        """Update the embedding vector for a specific text chunk.
        
        Args:
            chunk_id: The unique identifier of the chunk.
            file_id: The parent file ID for ownership verification.
            owner_user_id: The owner user ID for security check.
            embedding_vector: The embedding vector to store.
            
        Returns:
            True if the chunk was found and updated, False otherwise.
        """
        # Verify ownership first
        reference = self.get_reference_file_for_owner(file_id, owner_user_id)
        if reference is None:
            return False
        
        import pickle
        embedding_blob = pickle.dumps(embedding_vector)
        
        with self._connect() as connection:
            result = connection.execute(
                """
                UPDATE text_chunks 
                SET embedding_vector = ? 
                WHERE chunk_id = ? AND file_id = ?
                """,
                (embedding_blob, chunk_id, file_id),
            )
            connection.commit()
            return result.rowcount > 0

    def search_similar_chunks(
        self,
        query_embedding: list[float],
        file_ids: list[str] | None = None,
        top_k: int = 5,
        embedding_type: str | None = None,
    ) -> list[StoredTextChunk]:
        """Find text chunks most similar to a query embedding using cosine similarity.
        
        This uses SQLite's built-in math functions for cosine similarity calculation.
        For production use with large datasets, consider using a vector database.
        
        Args:
            query_embedding: The query embedding vector.
            file_ids: Optional list of file IDs to restrict the search scope.
            top_k: Number of results to return.
            embedding_type: Optional filter by embedding type ("text" or "image").
            
        Returns:
            List of text chunks ordered by similarity (most similar first).
        """
        import pickle
        import math
        
        if not query_embedding:
            return []
        
        # Calculate query magnitude for normalization
        query_magnitude = math.sqrt(sum(x * x for x in query_embedding))
        if query_magnitude == 0:
            return []
        
        # Normalize query embedding
        normalized_query = [x / query_magnitude for x in query_embedding]
        query_blob = pickle.dumps(normalized_query)
        
        with self._connect() as connection:
            connection.execute("PRAGMA temp_store = MEMORY")
            
            # Build WHERE clause for embedding type filter
            type_filter = f"AND embedding_type = '{embedding_type}'" if embedding_type else ""
            
            # Create temporary table with precomputed magnitudes
            connection.execute(f"""
                CREATE TEMP TABLE IF NOT EXISTS chunk_magnitudes AS
                SELECT 
                    chunk_id,
                    file_id,
                    chunk_index,
                    text_content,
                    source_page,
                    created_at,
                    embedding_vector
                FROM text_chunks
                WHERE embedding_vector IS NOT NULL {type_filter}
            """)
            
            if file_ids:
                placeholders = ",".join("?" for _ in file_ids)
                cursor = connection.execute(
                    f"""
                    SELECT chunk_id, file_id, chunk_index, text_content, source_page, created_at, embedding_vector
                    FROM chunk_magnitudes
                    WHERE file_id IN ({placeholders})
                    ORDER BY ROWID DESC
                    LIMIT {top_k * 2}
                    """,
                    file_ids,
                )
            else:
                cursor = connection.execute(
                    f"""
                    SELECT chunk_id, file_id, chunk_index, text_content, source_page, created_at, embedding_vector
                    FROM chunk_magnitudes
                    WHERE 1=1 {type_filter}
                    ORDER BY ROWID DESC
                    LIMIT {top_k * 2}
                    """
                )
            
            results = []
            for row in cursor.fetchall():
                embedding_blob = row["embedding_vector"]
                if embedding_blob is None:
                    continue
                    
                try:
                    chunk_embedding = pickle.loads(embedding_blob)
                    # Calculate cosine similarity
                    dot_product = sum(a * b for a, b in zip(normalized_query, chunk_embedding))
                    
                    # Store with similarity score temporarily
                    results.append((dot_product, row))
                except (pickle.PickleError, TypeError, ValueError):
                    continue
            
            # Sort by similarity descending and take top_k
            results.sort(key=lambda x: x[0], reverse=True)
            results = results[:top_k]
            
            return [
                StoredTextChunk(
                    chunk_id=row["chunk_id"],
                    file_id=row["file_id"],
                    chunk_index=row["chunk_index"],
                    text_content=row["text_content"],
                    source_page=row["source_page"],
                    embedding_type=embedding_type or "text",
                    embedding_vector=None,  # Don't return full embedding in result
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
                for _, row in results
            ]

    def search_similar_images(
        self,
        query_embedding: list[float],
        file_ids: list[str] | None = None,
        top_k: int = 5,
    ) -> list[StoredImageEmbedding]:
        """Find images most similar to a query embedding using cosine similarity.
        
        This enables Visual RAG by searching image embeddings with text or image queries.
        
        Args:
            query_embedding: The query embedding vector (from text or image).
            file_ids: Optional list of file IDs to restrict the search scope.
            top_k: Number of results to return.
            
        Returns:
            List of image embeddings ordered by similarity (most similar first).
        """
        import pickle
        import math
        
        if not query_embedding:
            return []
        
        # Calculate query magnitude for normalization
        query_magnitude = math.sqrt(sum(x * x for x in query_embedding))
        if query_magnitude == 0:
            return []
        
        # Normalize query embedding
        normalized_query = [x / query_magnitude for x in query_embedding]
        
        with self._connect() as connection:
            connection.execute("PRAGMA temp_store = MEMORY")
            
            if file_ids:
                placeholders = ",".join("?" for _ in file_ids)
                cursor = connection.execute(
                    f"""
                    SELECT image_id, file_id, source_page, storage_path, embedding_vector, caption, created_at
                    FROM image_embeddings
                    WHERE embedding_vector IS NOT NULL AND file_id IN ({placeholders})
                    ORDER BY ROWID DESC
                    LIMIT {top_k * 2}
                    """,
                    file_ids,
                )
            else:
                cursor = connection.execute(
                    f"""
                    SELECT image_id, file_id, source_page, storage_path, embedding_vector, caption, created_at
                    FROM image_embeddings
                    WHERE embedding_vector IS NOT NULL
                    ORDER BY ROWID DESC
                    LIMIT {top_k * 2}
                    """
                )
            
            results = []
            for row in cursor.fetchall():
                embedding_blob = row["embedding_vector"]
                if embedding_blob is None:
                    continue
                    
                try:
                    image_embedding = pickle.loads(embedding_blob)
                    # Calculate cosine similarity
                    dot_product = sum(a * b for a, b in zip(normalized_query, image_embedding))
                    
                    # Store with similarity score temporarily
                    results.append((dot_product, row))
                except (pickle.PickleError, TypeError, ValueError):
                    continue
            
            # Sort by similarity descending and take top_k
            results.sort(key=lambda x: x[0], reverse=True)
            results = results[:top_k]
            
            return [
                StoredImageEmbedding(
                    image_id=row["image_id"],
                    file_id=row["file_id"],
                    source_page=row["source_page"],
                    storage_path=row["storage_path"],
                    embedding_vector=None,  # Don't return full embedding in result
                    caption=row["caption"],
                    created_at=datetime.fromisoformat(row["created_at"]),
                )
                for _, row in results
            ]

    def get_text_chunks_for_file(
        self,
        file_id: str,
        owner_user_id: str,
    ) -> list[StoredTextChunk]:
        """Retrieve all text chunks for a specific reference file.
        
        Args:
            file_id: The file identifier.
            owner_user_id: The owner user ID for security verification.
            
        Returns:
            List of text chunks belonging to the file.
        """
        reference = self.get_reference_file_for_owner(file_id, owner_user_id)
        if reference is None:
            return []
        
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM text_chunks WHERE file_id = ? ORDER BY chunk_index",
                (file_id,),
            ).fetchall()
        
        return [self._map_chunk_row(row) for row in rows]

    def _map_chunk_row(self, row: sqlite3.Row) -> StoredTextChunk:
        import pickle
        
        embedding_blob = row["embedding_vector"]
        embedding_vector = None
        if embedding_blob is not None:
            try:
                embedding_vector = pickle.loads(embedding_blob)
            except (pickle.PickleError, TypeError, ValueError):
                pass
        
        return StoredTextChunk(
            chunk_id=row["chunk_id"],
            file_id=row["file_id"],
            chunk_index=row["chunk_index"],
            text_content=row["text_content"],
            source_page=row["source_page"],
            embedding_vector=embedding_vector,
            created_at=datetime.fromisoformat(row["created_at"]),
        )
