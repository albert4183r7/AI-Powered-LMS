"""
Embedding Service for generating vector embeddings.
Supports both text and image embeddings for Visual RAG.
"""

import logging
from typing import List, Optional, Union
import numpy as np
from sentence_transformers import SentenceTransformer
from PIL import Image
import io

logger = logging.getLogger(__name__)


class EmbeddingService:
    """Service for generating text and image embeddings."""
    
    def __init__(self):
        self.text_model = None
        self.image_model = None
        self.initialized = False
        
    def initialize(self):
        """Initialize embedding models."""
        try:
            logger.info("Loading text embedding model...")
            # Multilingual text embedding model
            self.text_model = SentenceTransformer('intfloat/multilingual-e5-small')
            
            logger.info("Loading image embedding model...")
            # CLIP model for image embeddings
            self.image_model = SentenceTransformer('sentence-transformers/clip-ViT-B-32')
            
            self.initialized = True
            logger.info("Embedding models loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load embedding models: {e}")
            self.initialized = False
    
    def embed_text(self, texts: Union[str, List[str]]) -> Optional[np.ndarray]:
        """
        Generate embeddings for text.
        
        Args:
            texts: Single text string or list of text strings
            
        Returns:
            Numpy array of embeddings or None if failed
        """
        if not self.initialized or self.text_model is None:
            logger.warning("Text embedding model not initialized")
            return None
        
        try:
            if isinstance(texts, str):
                texts = [texts]
            
            # Add E5 prefix for better embeddings
            prefixed_texts = [f"passage: {text}" for text in texts]
            
            embeddings = self.text_model.encode(
                prefixed_texts,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False
            )
            
            return embeddings
        except Exception as e:
            logger.error(f"Error generating text embeddings: {e}")
            return None
    
    def embed_query(self, query: str) -> Optional[np.ndarray]:
        """
        Generate embedding for a search query.
        
        Args:
            query: Search query string
            
        Returns:
            Numpy array of embedding or None if failed
        """
        if not self.initialized or self.text_model is None:
            logger.warning("Text embedding model not initialized")
            return None
        
        try:
            # Add E5 query prefix
            prefixed_query = f"query: {query}"
            
            embedding = self.text_model.encode(
                [prefixed_query],
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False
            )
            
            return embedding[0]
        except Exception as e:
            logger.error(f"Error generating query embedding: {e}")
            return None
    
    def embed_image(self, image_data: Union[bytes, Image.Image]) -> Optional[np.ndarray]:
        """
        Generate embeddings for an image.
        
        Args:
            image_data: Image bytes or PIL Image object
            
        Returns:
            Numpy array of embedding or None if failed
        """
        if not self.initialized or self.image_model is None:
            logger.warning("Image embedding model not initialized")
            return None
        
        try:
            # Convert bytes to PIL Image if needed
            if isinstance(image_data, bytes):
                image = Image.open(io.BytesIO(image_data))
            else:
                image = image_data
            
            # Ensure image is in RGB mode
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            embedding = self.image_model.encode(
                [image],
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False
            )
            
            return embedding[0]
        except Exception as e:
            logger.error(f"Error generating image embedding: {e}")
            return None
    
    def embed_images_batch(self, images: List[Union[bytes, Image.Image]]) -> Optional[np.ndarray]:
        """
        Generate embeddings for multiple images.
        
        Args:
            images: List of image bytes or PIL Image objects
            
        Returns:
            Numpy array of embeddings or None if failed
        """
        if not self.initialized or self.image_model is None:
            logger.warning("Image embedding model not initialized")
            return None
        
        try:
            processed_images = []
            for img_data in images:
                if isinstance(img_data, bytes):
                    image = Image.open(io.BytesIO(img_data))
                else:
                    image = img_data
                
                if image.mode != 'RGB':
                    image = image.convert('RGB')
                processed_images.append(image)
            
            embeddings = self.image_model.encode(
                processed_images,
                convert_to_numpy=True,
                normalize_embeddings=True,
                show_progress_bar=False
            )
            
            return embeddings
        except Exception as e:
            logger.error(f"Error generating batch image embeddings: {e}")
            return None
    
    def get_embedding_dimension(self, modality: str = "text") -> int:
        """Get the dimension of embeddings for the specified modality."""
        if modality == "text":
            return 384  # multilingual-e5-small dimension
        elif modality == "image":
            return 512  # clip-ViT-B-32 dimension
        else:
            return 384


# Singleton instance
_embedding_service: Optional[EmbeddingService] = None


def get_embedding_service() -> EmbeddingService:
    """Get or create the embedding service singleton."""
    global _embedding_service
    if _embedding_service is None:
        _embedding_service = EmbeddingService()
        _embedding_service.initialize()
    return _embedding_service
