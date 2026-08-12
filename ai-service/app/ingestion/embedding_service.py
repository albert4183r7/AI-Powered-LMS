"""Embedding service using sentence-transformers for local vector generation."""

import logging
from typing import Any

from sentence_transformers import SentenceTransformer

LOGGER = logging.getLogger(__name__)

TEXT_EMBEDDING_MODEL_NAME = "intfloat/multilingual-e5-small"
IMAGE_EMBEDDING_MODEL_NAME = "clip-ViT-B-32"


class EmbeddingService:
    """Generate embeddings using local sentence-transformers models.
    
    This service loads both text and image embedding models once and reuses 
    them for all embedding requests. Supports multilingual text (Indonesian & English)
    and image embeddings for Visual RAG using CLIP.
    """
    
    def __init__(
        self, 
        text_model_name: str = TEXT_EMBEDDING_MODEL_NAME,
        image_model_name: str = IMAGE_EMBEDDING_MODEL_NAME,
    ) -> None:
        LOGGER.info("Loading text embedding model: %s", text_model_name)
        self._text_model = SentenceTransformer(text_model_name)
        LOGGER.info("Text embedding model loaded successfully.")
        
        LOGGER.info("Loading image embedding model: %s", image_model_name)
        self._image_model = SentenceTransformer(image_model_name)
        LOGGER.info("Image embedding model (CLIP) loaded successfully.")
    
    def embed_documents(self, documents: list[str]) -> list[list[float]]:
        """Generate text embeddings for multiple documents.
        
        Args:
            documents: List of text chunks to embed.
            
        Returns:
            List of embedding vectors as lists of floats.
        """
        if not documents:
            return []
        
        # E5 models expect "passage:" prefix for documents
        prefixed_docs = [f"passage: {doc}" for doc in documents]
        embeddings = self._text_model.encode(
            prefixed_docs,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return embeddings.tolist()
    
    def embed_query(self, query: str) -> list[float]:
        """Generate a text embedding for a search query.
        
        Args:
            query: The query text to embed.
            
        Returns:
            Embedding vector as a list of floats.
        """
        # E5 models expect "query:" prefix for queries
        prefixed_query = f"query: {query}"
        embedding = self._text_model.encode(
            prefixed_query,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return embedding.tolist()
    
    def embed_images(self, images: list[Any]) -> list[list[float]]:
        """Generate image embeddings using CLIP model.
        
        Args:
            images: List of PIL Image objects or image file paths.
            
        Returns:
            List of embedding vectors as lists of floats.
        """
        if not images:
            return []
        
        embeddings = self._image_model.encode(
            images,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return embeddings.tolist()
    
    def embed_query_for_images(self, query: str) -> list[float]:
        """Generate a query embedding compatible with image embeddings (CLIP).
        
        This allows text-to-image search using the same vector space.
        
        Args:
            query: The query text to embed.
            
        Returns:
            Embedding vector as a list of floats, compatible with image embeddings.
        """
        embedding = self._image_model.encode(
            query,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return embedding.tolist()
