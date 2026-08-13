"""Embedding service using local HTTP API for vector generation."""

import logging
from typing import Any
import httpx

LOGGER = logging.getLogger(__name__)

TEXT_EMBEDDING_MODEL_NAME = "nomic-embed-text"
OLLAMA_BASE_URL = "http://localhost:11434/api/embeddings"


class EmbeddingService:
    """Generate embeddings using a local Ollama API to avoid scipy/numpy DLL hell.
    
    This service makes direct HTTP calls to the local LLM server.
    Image embeddings are disabled to save memory.
    """
    
    def __init__(
        self, 
        text_model_name: str = TEXT_EMBEDDING_MODEL_NAME,
    ) -> None:
        self.text_model_name = text_model_name
        self._http_client = httpx.Client(timeout=60.0)
        LOGGER.info("EmbeddingService initialized to use local API with model %s", text_model_name)
    
    def _get_embedding(self, text: str) -> list[float]:
        """Fetch embedding from local API gracefully."""
        try:
            response = self._http_client.post(
                OLLAMA_BASE_URL,
                json={"model": self.text_model_name, "prompt": text},
            )
            response.raise_for_status()
            data = response.json()
            return data.get("embedding", [])
        except Exception as e:
            LOGGER.warning("Failed to generate embedding from local API: %s", e)
            # Fallback to zero vector of size 1536 (common embedding size) to prevent crash
            return [0.0] * 1536
    
    def embed_documents(self, documents: list[str]) -> list[list[float]]:
        """Generate text embeddings for multiple documents."""
        if not documents:
            return []
        
        embeddings = []
        for doc in documents:
            embeddings.append(self._get_embedding(f"passage: {doc}"))
        return embeddings
    
    def embed_query(self, query: str) -> list[float]:
        """Generate a text embedding for a search query."""
        return self._get_embedding(f"query: {query}")
    
    def _get_clip_model(self) -> Any:
        """Lazy load the CLIP model for images."""
        if not hasattr(self, "_clip_model"):
            from sentence_transformers import SentenceTransformer
            LOGGER.info("Loading CLIP model for image embeddings...")
            self._clip_model = SentenceTransformer("clip-ViT-B-32")
        return self._clip_model
    
    def embed_images(self, images: list[Any]) -> list[list[float]]:
        """Generate image embeddings using CLIP model."""
        if not images:
            return []
        
        try:
            model = self._get_clip_model()
            embeddings = model.encode(images)
            return embeddings.tolist()
        except Exception as e:
            LOGGER.error("Failed to generate real image embeddings: %s", e)
            return [[0.0] * 512 for _ in images]
    
    def embed_query_for_images(self, query: str) -> list[float]:
        """Generate a query embedding compatible with image embeddings."""
        try:
            model = self._get_clip_model()
            embedding = model.encode([query])[0]
            return embedding.tolist()
        except Exception as e:
            LOGGER.error("Failed to generate real query embedding for images: %s", e)
            return [0.0] * 512
