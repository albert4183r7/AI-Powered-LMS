"""RAG (Retrieval-Augmented Generation) service for reference-based content retrieval.

This service supports both text and visual (image) RAG for enhanced context retrieval.
"""

import logging
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from PIL import Image

from app.ingestion.embedding_service import EmbeddingService
from app.ingestion.reference_repository import (
    ReferenceRepository,
    StoredImageEmbedding,
    StoredTextChunk,
)

LOGGER = logging.getLogger(__name__)

DEFAULT_CHUNK_SIZE_CHARS = 500
DEFAULT_CHUNK_OVERLAP_CHARS = 50
DEFAULT_TOP_K = 5
DEFAULT_TOP_K_IMAGES = 3


@dataclass(frozen=True)
class RetrievedContext:
    """A retrieved text chunk with citation information."""

    text_content: str
    source_filename: str
    source_page: int | None
    relevance_score: float
    context_type: str = "text"  # "text" or "image"


@dataclass(frozen=True)
class RetrievedImageContext:
    """A retrieved image with citation and caption information."""

    image_path: str
    source_filename: str
    source_page: int | None
    width: int | None
    height: int | None
    caption: str | None
    relevance_score: float
    context_type: str = "image"


class RagService:
    """Provide RAG capabilities using local embeddings and SQLite storage."""

    def __init__(
        self,
        reference_repository: ReferenceRepository,
        embedding_service: EmbeddingService,
        *,
        chunk_size_chars: int = DEFAULT_CHUNK_SIZE_CHARS,
        chunk_overlap_chars: int = DEFAULT_CHUNK_OVERLAP_CHARS,
        top_k: int = DEFAULT_TOP_K,
    ) -> None:
        self._reference_repository = reference_repository
        self._embedding_service = embedding_service
        self._chunk_size_chars = chunk_size_chars
        self._chunk_overlap_chars = chunk_overlap_chars
        self._top_k = top_k

    def chunk_text(
        self,
        text: str,
        source_page: int | None = None,
    ) -> list[tuple[str, str, int, str, int | None]]:
        """Split text into overlapping chunks for embedding.
        
        Args:
            text: The full text to chunk.
            source_page: Optional page/slide number for citation.
            
        Returns:
            List of tuples (chunk_id, file_id, chunk_index, text_content, source_page).
            Note: file_id must be provided by the caller when storing.
        """
        if not text.strip():
            return []

        chunks = []
        start = 0
        chunk_index = 0

        while start < len(text):
            end = start + self._chunk_size_chars
            
            # If we're not at the end of the text, try to break at a sentence boundary
            if end < len(text):
                # Look for sentence boundaries in the overlap region
                search_start = max(start, end - self._chunk_overlap_chars)
                
                # Try to find a period, newline, or other natural break point
                for break_char in [".\n", ". ", "\n\n", "\n", " "]:
                    last_break = text.rfind(break_char, search_start, end + 20)
                    if last_break > start:
                        end = last_break + len(break_char)
                        break
            
            chunk_text = text[start:end].strip()
            
            if chunk_text:
                chunk_id = str(uuid.uuid4())
                # file_id will be set by caller
                chunks.append((chunk_id, "", chunk_index, chunk_text, source_page))
                chunk_index += 1
            
            start = end - self._chunk_overlap_chars
            if start >= len(text):
                break

        return chunks

    def ingest_reference_chunks(
        self,
        file_id: str,
        owner_user_id: str,
        text_with_pages: list[tuple[str, int | None]],
    ) -> int:
        """Ingest text chunks from a reference file and compute embeddings.
        
        Args:
            file_id: The unique identifier of the reference file.
            owner_user_id: The owner user ID for security verification.
            text_with_pages: List of (text_content, page_number) tuples.
            
        Returns:
            The number of chunks ingested.
        """
        all_chunks = []
        for text_content, source_page in text_with_pages:
            file_chunks = self.chunk_text(text_content, source_page)
            # Set the file_id for each chunk
            file_chunks_with_id = [
                (chunk_id, file_id, chunk_index, text, page)
                for chunk_id, _, chunk_index, text, page in file_chunks
            ]
            all_chunks.extend(file_chunks_with_id)

        if not all_chunks:
            LOGGER.warning("No chunks generated for file %s", file_id)
            return 0

        # Store chunks in database
        stored_chunks = self._reference_repository.store_text_chunks(all_chunks)
        LOGGER.info("Stored %d text chunks for file %s", len(stored_chunks), file_id)

        # Compute embeddings in batches
        batch_size = 32
        for i in range(0, len(stored_chunks), batch_size):
            batch = stored_chunks[i : i + batch_size]
            texts = [chunk.text_content for chunk in batch]
            
            try:
                embeddings = self._embedding_service.embed_documents(texts)
                
                # Update each chunk with its embedding
                for chunk, embedding in zip(batch, embeddings):
                    success = self._reference_repository.update_chunk_embedding(
                        chunk_id=chunk.chunk_id,
                        file_id=file_id,
                        owner_user_id=owner_user_id,
                        embedding_vector=embedding,
                    )
                    if not success:
                        LOGGER.warning(
                            "Failed to update embedding for chunk %s", chunk.chunk_id
                        )
                        
            except Exception as e:
                LOGGER.error(
                    "Failed to compute embeddings for batch %d-%d: %s",
                    i,
                    i + len(batch),
                    e,
                )
                # Continue with next batch instead of failing entirely

        return len(stored_chunks)

    def retrieve_relevant_context(
        self,
        query: str,
        file_ids: list[str] | None = None,
        top_k: int | None = None,
        include_images: bool = True,
        owner_user_id: str = "",
    ) -> list[RetrievedContext]:
        """Retrieve the most relevant text chunks and optionally images for a query.
        
        Args:
            query: The search query.
            file_ids: Optional list of file IDs to restrict the search.
            top_k: Number of text results to return (defaults to instance setting).
            include_images: Whether to also search for relevant images.
            
        Returns:
            List of retrieved contexts (text and/or image) ordered by relevance.
        """
        if not query.strip():
            return []

        k = top_k if top_k is not None else self._top_k
        
        # Embed the query for text search
        try:
            query_embedding = self._embedding_service.embed_query(query)
        except Exception as e:
            LOGGER.error("Failed to embed query: %s", e)
            return []

        # Search for similar text chunks
        similar_chunks = self._reference_repository.search_similar_chunks(
            query_embedding=query_embedding,
            file_ids=file_ids,
            top_k=k,
        )

        results: list[RetrievedContext] = []
        
        # Build retrieved text contexts with citation info
        for chunk in similar_chunks:
            reference = self._reference_repository.get_reference_file_for_owner(
                chunk.file_id,
                owner_user_id,
            )
            source_filename = reference.original_filename if reference else "Unknown"
            
            results.append(
                RetrievedContext(
                    text_content=chunk.text_content,
                    source_filename=source_filename,
                    source_page=chunk.source_page,
                    relevance_score=0.0,
                    context_type="text",
                )
            )

        # Optionally search for relevant images using Visual RAG
        if include_images:
            try:
                # Use CLIP to embed the query for image search
                image_query_embedding = self._embedding_service.embed_query_for_images(query)
                
                similar_images = self._reference_repository.search_similar_images(
                    query_embedding=image_query_embedding,
                    file_ids=file_ids,
                    top_k=DEFAULT_TOP_K_IMAGES,
                )
                
                for img in similar_images:
                    reference = self._reference_repository.get_reference_file_for_owner(
                        img.file_id,
                        owner_user_id,
                    )
                    source_filename = reference.original_filename if reference else "Unknown"
                    
                    results.append(
                        RetrievedContext(
                            text_content=f"[IMAGE: {img.caption or 'No caption'}]",
                            source_filename=source_filename,
                            source_page=img.source_page,
                            relevance_score=0.0,
                            context_type="image",
                        )
                    )
            except Exception as e:
                LOGGER.warning("Failed to search images for query '%s': %s", query, e)

        return results

    def retrieve_relevant_images(
        self,
        query: str,
        file_ids: list[str] | None = None,
        top_k: int = DEFAULT_TOP_K_IMAGES,
    ) -> list[RetrievedImageContext]:
        """Retrieve the most relevant images for a text query using Visual RAG.
        
        This uses CLIP embeddings to enable text-to-image search.
        
        Args:
            query: The search query describing the desired images.
            file_ids: Optional list of file IDs to restrict the search.
            top_k: Number of image results to return.
            
        Returns:
            List of retrieved image contexts ordered by relevance.
        """
        if not query.strip():
            return []
        
        try:
            # Use CLIP to embed the query for image search
            image_query_embedding = self._embedding_service.embed_query_for_images(query)
            
            similar_images = self._reference_repository.search_similar_images(
                query_embedding=image_query_embedding,
                file_ids=file_ids,
                top_k=top_k,
            )
            
            results: list[RetrievedImageContext] = []
            for img in similar_images:
                reference = self._reference_repository.get_reference_file_for_owner(
                    img.file_id,
                    "",
                )
                source_filename = reference.original_filename if reference else "Unknown"
                
                results.append(
                    RetrievedImageContext(
                        image_path=img.storage_path,
                        source_filename=source_filename,
                        source_page=img.source_page,
                        width=img.width,
                        height=img.height,
                        caption=img.caption,
                        relevance_score=0.0,
                        context_type="image",
                    )
                )
            
            return results
        except Exception as e:
            LOGGER.error("Failed to search images: %s", e)
            return []

    def ingest_image_with_embedding(
        self,
        file_id: str,
        owner_user_id: str,
        image_id: str,
        image_path: str,
        source_page: int,
        caption: str | None = None,
    ) -> bool:
        """Ingest an image by computing its CLIP embedding and storing it.
        
        Args:
            file_id: The parent reference file ID.
            owner_user_id: The owner user ID for security verification.
            image_id: Unique identifier for the image.
            image_path: File path to the image.
            source_page: Page/slide number where the image was found.
            caption: Optional AI-generated caption for the image.
            
        Returns:
            True if successfully ingested, False otherwise.
        """
        try:
            # Load and compute embedding for the image
            image = Image.open(image_path)
            embeddings = self._embedding_service.embed_images([image])
            if not embeddings:
                LOGGER.warning("Image embeddings are disabled, skipping ingestion for %s", image_id)
                return False
            embedding = embeddings[0]
            
            # Store the image embedding
            result = self._reference_repository.store_image_embedding(
                image_id=image_id,
                file_id=file_id,
                source_page=source_page,
                storage_path=image_path,
                embedding_vector=embedding,
                caption=caption,
            )
            
            if result:
                LOGGER.info("Successfully ingested image %s with embedding", image_id)
                return True
            else:
                LOGGER.warning("Failed to store image embedding for %s", image_id)
                return False
                
        except Exception as e:
            LOGGER.error("Failed to ingest image %s: %s", image_id, e)
            return False

    def build_rag_context(
        self,
        query: str,
        file_ids: list[str] | None = None,
        max_context_length: int = 2000,
        owner_user_id: str = "",
    ) -> str:
        """Build a formatted context string for injection into model prompts.
        
        Args:
            query: The search query.
            file_ids: Optional list of file IDs to restrict the search.
            max_context_length: Maximum total characters for the context.
            
        Returns:
            Formatted context string with citations.
        """
        contexts = self.retrieve_relevant_context(query, file_ids, owner_user_id=owner_user_id)
        
        if not contexts:
            return ""

        formatted_parts = []
        total_length = 0
        
        for i, ctx in enumerate(contexts, 1):
            page_info = f" (page {ctx.source_page})" if ctx.source_page else ""
            citation = f"[Source: {ctx.source_filename}{page_info}]"
            formatted = f"{citation}\n{ctx.text_content}\n"
            
            if total_length + len(formatted) > max_context_length:
                # Add partial content if we have space for at least some text
                remaining = max_context_length - total_length - len(citation) - 2
                if remaining > 20:
                    formatted_parts.append(f"{citation}\n{ctx.text_content[:remaining]}...")
                break
            
            formatted_parts.append(formatted)
            total_length += len(formatted)

        if not formatted_parts:
            return ""

        return "--- RELEVANT CONTEXT FROM REFERENCES ---\n" + "\n---\n".join(formatted_parts) + "\n--- END CONTEXT ---\n"
