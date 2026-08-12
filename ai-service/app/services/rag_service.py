"""
RAG (Retrieval-Augmented Generation) Service
Combines reference materials with web search to provide comprehensive context for AI generation.
Supports multi-modal retrieval: text chunks, images, and web search results.
"""

import logging
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import re

from app.services.embedding_service import EmbeddingService
from app.ingestion.reference_repository import ReferenceRepository
from app.services.web_search_service import WebSearchService, SearchResult

logger = logging.getLogger(__name__)


@dataclass
class ContextItem:
    """Represents a retrieved context item from any source."""
    content: str
    source_type: str  # "text_chunk", "image", "web_search"
    source_id: str
    source_title: str
    citation: str
    relevance_score: float
    metadata: Dict[str, Any]


class RagService:
    """
    RAG service that retrieves relevant context from multiple sources:
    1. Text chunks from uploaded references
    2. Image embeddings from uploaded references  
    3. Web search results for real-time information
    
    Combines these into a unified context for LLM prompts.
    """
    
    def __init__(
        self,
        embedding_service: EmbeddingService,
        reference_repository: ReferenceRepository,
        web_search_service: Optional[WebSearchService] = None
    ):
        self.embedding_service = embedding_service
        self.reference_repository = reference_repository
        self.web_search_service = web_search_service
        
        self.max_text_chunks = 5
        self.max_images = 3
        self.max_web_results = 5
        self.relevance_threshold = 0.3
    
    async def ingest_reference_chunks(
        self,
        reference_id: int,
        owner_user_id: int,
        text_content: str,
        chunk_size: int = 500,
        chunk_overlap: int = 50
    ) -> int:
        """
        Process a reference document into searchable chunks with embeddings.
        
        Args:
            reference_id: ID of the reference
            owner_user_id: User ID for security checks
            text_content: Full text content of the reference
            chunk_size: Characters per chunk
            chunk_overlap: Overlap between chunks
            
        Returns:
            Number of chunks created
        """
        try:
            # Chunk the text
            chunks = self._chunk_text(
                text_content, 
                chunk_size, 
                chunk_overlap
            )
            
            if not chunks:
                logger.warning(f"No chunks created for reference {reference_id}")
                return 0
            
            # Generate embeddings in batch
            texts = [chunk["text"] for chunk in chunks]
            embeddings = await self.embedding_service.embed_documents(texts)
            
            # Store chunks with embeddings
            stored_count = 0
            for i, chunk in enumerate(chunks):
                if i < len(embeddings):
                    embedding_vector = embeddings[i].tolist()
                    
                    self.reference_repository.add_text_chunk(
                        reference_id=reference_id,
                        chunk_text=chunk["text"],
                        chunk_index=i,
                        start_char=chunk["start"],
                        end_char=chunk["end"],
                        embedding=embedding_vector,
                        owner_user_id=owner_user_id
                    )
                    stored_count += 1
            
            logger.info(f"Ingested {stored_count} chunks for reference {reference_id}")
            return stored_count
            
        except Exception as e:
            logger.error(f"Failed to ingest reference chunks: {str(e)}")
            return 0
    
    async def ingest_image_with_embedding(
        self,
        reference_id: int,
        image_data: bytes,
        image_description: str,
        page_number: Optional[int] = None,
        owner_user_id: Optional[int] = None
    ) -> bool:
        """
        Process an image from a reference and store its embedding.
        
        Args:
            reference_id: ID of the reference
            image_data: Raw image bytes
            image_description: Description/caption of the image
            page_number: Page number where image appears
            owner_user_id: User ID for security checks
            
        Returns:
            True if successful
        """
        try:
            # Generate image embedding
            embedding = await self.embedding_service.embed_image(image_data)
            embedding_vector = embedding.tolist()
            
            # Store image embedding
            self.reference_repository.add_image_embedding(
                reference_id=reference_id,
                image_description=image_description,
                page_number=page_number,
                embedding=embedding_vector,
                owner_user_id=owner_user_id
            )
            
            logger.info(f"Ingested image for reference {reference_id}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to ingest image: {str(e)}")
            return False
    
    async def search_context(
        self,
        query: str,
        owner_user_id: int,
        reference_ids: Optional[List[int]] = None,
        include_web_search: bool = False,
        module_topic: Optional[str] = None
    ) -> List[ContextItem]:
        """
        Search for relevant context across all sources.
        
        Args:
            query: Search query
            owner_user_id: User ID for security checks
            reference_ids: Optional list of specific references to search
            include_web_search: Whether to include web search results
            module_topic: Topic for web search (if different from query)
            
        Returns:
            List of ContextItem objects ranked by relevance
        """
        all_items = []
        
        # 1. Search text chunks
        try:
            query_embedding = await self.embedding_service.embed_query(query)
            query_vector = query_embedding.tolist()
            
            text_chunks = self.reference_repository.search_similar_chunks(
                query_embedding=query_vector,
                owner_user_id=owner_user_id,
                reference_ids=reference_ids,
                top_k=self.max_text_chunks,
                threshold=self.relevance_threshold
            )
            
            for chunk in text_chunks:
                item = ContextItem(
                    content=chunk["chunk_text"],
                    source_type="text_chunk",
                    source_id=str(chunk["reference_id"]),
                    source_title=f"Reference #{chunk['reference_id']}",
                    citation=f"Ref #{chunk['reference_id']}, pages {chunk.get('page_number', 'N/A')}",
                    relevance_score=chunk.get("similarity_score", 0.0),
                    metadata={
                        "start_char": chunk.get("start_char"),
                        "end_char": chunk.get("end_char"),
                        "chunk_index": chunk.get("chunk_index")
                    }
                )
                all_items.append(item)
                
        except Exception as e:
            logger.error(f"Text chunk search failed: {str(e)}")
        
        # 2. Search images
        try:
            query_embedding = await self.embedding_service.embed_query(query)
            query_vector = query_embedding.tolist()
            
            images = self.reference_repository.search_similar_images(
                query_embedding=query_vector,
                owner_user_id=owner_user_id,
                reference_ids=reference_ids,
                top_k=self.max_images,
                threshold=self.relevance_threshold
            )
            
            for img in images:
                item = ContextItem(
                    content=f"[IMAGE: {img['image_description']}]",
                    source_type="image",
                    source_id=str(img["id"]),
                    source_title=f"Image from Reference #{img['reference_id']}",
                    citation=f"Ref #{img['reference_id']}, page {img.get('page_number', 'N/A')}",
                    relevance_score=img.get("similarity_score", 0.0),
                    metadata={
                        "page_number": img.get("page_number"),
                        "image_description": img["image_description"]
                    }
                )
                all_items.append(item)
                
        except Exception as e:
            logger.error(f"Image search failed: {str(e)}")
        
        # 3. Web search (optional)
        if include_web_search and self.web_search_service:
            try:
                search_topic = module_topic or query
                web_results = await self.web_search_service.search(
                    query=search_topic,
                    search_type="academic",
                    max_results=self.max_web_results
                )
                
                for result in web_results:
                    item = ContextItem(
                        content=f"{result.title}\n\n{result.snippet}",
                        source_type="web_search",
                        source_id=result.url,
                        source_title=result.title,
                        citation=f"Source: {result.source} ({result.url})",
                        relevance_score=result.relevance_score,
                        metadata={
                            "url": result.url,
                            "source": result.source,
                            "published_date": result.published_date
                        }
                    )
                    all_items.append(item)
                    
            except Exception as e:
                logger.error(f"Web search failed: {str(e)}")
        
        # Sort by relevance score
        all_items.sort(key=lambda x: x.relevance_score, reverse=True)
        
        logger.info(f"Retrieved {len(all_items)} context items for query: {query[:50]}...")
        return all_items
    
    def build_context_for_prompt(
        self,
        context_items: List[ContextItem],
        max_tokens: int = 2000
    ) -> str:
        """
        Format retrieved context into a prompt-ready string.
        
        Args:
            context_items: List of retrieved context items
            max_tokens: Maximum token limit (approximate)
            
        Returns:
            Formatted context string with citations
        """
        if not context_items:
            return "No relevant context found."
        
        sections = []
        current_length = 0
        
        # Group by source type
        text_chunks = [item for item in context_items if item.source_type == "text_chunk"]
        images = [item for item in context_items if item.source_type == "image"]
        web_results = [item for item in context_items if item.source_type == "web_search"]
        
        # Add text chunks
        if text_chunks:
            sections.append("## Relevant Text Passages:")
            for i, item in enumerate(text_chunks, 1):
                section = f"\n[{i}] {item.content}\n   Citation: {item.citation}"
                if current_length + len(section) > max_tokens:
                    break
                sections.append(section)
                current_length += len(section)
        
        # Add images
        if images:
            sections.append("\n## Relevant Images:")
            for i, item in enumerate(images, 1):
                section = f"\n[{i}] {item.content}\n   Citation: {item.citation}"
                if current_length + len(section) > max_tokens:
                    break
                sections.append(section)
                current_length += len(section)
        
        # Add web results
        if web_results:
            sections.append("\n## External Sources:")
            for i, item in enumerate(web_results, 1):
                section = f"\n[{i}] {item.source_title}\n   {item.content}\n   Citation: {item.citation}"
                if current_length + len(section) > max_tokens:
                    break
                sections.append(section)
                current_length += len(section)
        
        return "\n".join(sections)
    
    def _chunk_text(
        self,
        text: str,
        chunk_size: int = 500,
        chunk_overlap: int = 50
    ) -> List[Dict[str, Any]]:
        """
        Split text into overlapping chunks with sentence boundary detection.
        
        Args:
            text: Input text
            chunk_size: Target chunk size in characters
            chunk_overlap: Overlap between consecutive chunks
            
        Returns:
            List of chunks with text and position metadata
        """
        if not text:
            return []
        
        chunks = []
        start = 0
        text_length = len(text)
        
        while start < text_length:
            end = start + chunk_size
            
            if end >= text_length:
                # Last chunk
                chunk_text = text[start:].strip()
                if chunk_text:
                    chunks.append({
                        "text": chunk_text,
                        "start": start,
                        "end": text_length
                    })
                break
            
            # Try to break at sentence boundary
            chunk_text = text[start:end]
            last_period = chunk_text.rfind('. ')
            last_newline = chunk_text.rfind('\n')
            
            if last_period > chunk_size * 0.5:  # At least halfway
                end = start + last_period + 1
            elif last_newline > chunk_size * 0.5:
                end = start + last_newline + 1
            
            chunk_text = text[start:end].strip()
            if chunk_text:
                chunks.append({
                    "text": chunk_text,
                    "start": start,
                    "end": end
                })
            
            # Move start with overlap
            start = end - chunk_overlap
        
        return chunks
