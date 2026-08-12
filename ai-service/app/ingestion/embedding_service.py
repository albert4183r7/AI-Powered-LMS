"""Embedding service using sentence-transformers for local vector generation."""

import logging
from typing import Any

from app.providers.gemini import GeminiClient

LOGGER = logging.getLogger(__name__)

TEXT_EMBEDDING_MODEL_NAME = "gemini-embedding-2"


class EmbeddingService:
    """Generate embeddings using local sentence-transformers models.
    
    This service loads both text and image embedding models once and reuses 
    them for all embedding requests. Supports multilingual text (Indonesian & English)
    and image embeddings for Visual RAG using CLIP.
    """
    
    def __init__(
        self, 
        gemini_client: GeminiClient,
        text_model_name: str = TEXT_EMBEDDING_MODEL_NAME,
    ) -> None:
        self._gemini_client = gemini_client
        self.text_model_name = text_model_name
        LOGGER.info("EmbeddingService initialized with Gemini API model %s", text_model_name)
    
    def embed_documents(self, documents: list[str]) -> list[list[float]]:
        """Generate text embeddings for multiple documents.
        
        Args:
            documents: List of text chunks to embed.
            
        Returns:
            List of embedding vectors as lists of floats.
        """
        if not documents:
            return []
        
        # Gemini embeddings don't require prefix like E5
        return self._gemini_client.create_text_embeddings(
            texts=documents,
            model=self.text_model_name
        )
    
    def embed_query(self, query: str) -> list[float]:
        """Generate a text embedding for a search query.
        
        Args:
            query: The query text to embed.
            
        Returns:
            Embedding vector as a list of floats.
        """
        # Gemini embeddings don't require prefix like E5
        embeddings = self._gemini_client.create_text_embeddings(
            texts=[query],
            model=self.text_model_name
        )
        if not embeddings:
            return []
        return embeddings[0]
    
    def embed_images(self, images: list[Any]) -> list[list[float]]:
        """Generate image embeddings using CLIP model.
        
        Args:
            images: List of PIL Image objects or image file paths.
            
        Returns:
            List of embedding vectors as lists of floats.
        """
        if not images:
            return []
        # Disabled to fit in 512MB RAM without PyTorch/CLIP.
        return []
    
    def embed_query_for_images(self, query: str) -> list[float]:
        """Generate a query embedding compatible with image embeddings (CLIP).
        
        This allows text-to-image search using the same vector space.
        
        Args:
            query: The query text to embed.
            
        Returns:
            Embedding vector as a list of floats, compatible with image embeddings.
        """
        # Image embeddings disabled to fit in 512MB RAM.
        return []
