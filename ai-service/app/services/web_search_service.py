"""
Web Search Service for RAG Enhancement
Provides real-time web search capabilities to supplement reference materials.
Uses DuckDuckGo Search API (free, no key required).
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from dataclasses import dataclass

try:
    from duckduckgo_search import DDGS
    DDGS_AVAILABLE = True
except ImportError:
    DDGS_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("duckduckgo-search not installed. Web search disabled.")

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Represents a web search result."""
    title: str
    snippet: str
    url: str
    source: str  # e.g., "wikipedia", "news", "academic"
    published_date: Optional[str] = None
    relevance_score: float = 0.0


class WebSearchService:
    """
    Service for performing web searches to enhance RAG context.
    Supports multiple search types: general, news, academic.
    """
    
    def __init__(self):
        if not DDGS_AVAILABLE:
            logger.error("DuckDuckGo Search library not available")
        
        self.max_results_per_query = 10
        self.search_timeout = 10  # seconds
        
        # Cache to avoid repeated searches (simple in-memory cache)
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._cache_ttl = timedelta(minutes=30)
    
    async def search(
        self,
        query: str,
        search_type: str = "general",
        max_results: int = 5,
        use_cache: bool = True
    ) -> List[SearchResult]:
        """
        Perform a web search.
        
        Args:
            query: Search query string
            search_type: Type of search ("general", "news", "academic")
            max_results: Maximum number of results to return
            use_cache: Whether to use cached results
            
        Returns:
            List of SearchResult objects
        """
        if not DDGS_AVAILABLE:
            logger.warning("Web search unavailable: duckduckgo-search not installed")
            return []
        
        # Check cache
        cache_key = f"{search_type}:{query}"
        if use_cache and cache_key in self._cache:
            cached = self._cache[cache_key]
            if datetime.now() - cached["timestamp"] < self._cache_ttl:
                logger.debug(f"Using cached results for: {query}")
                return cached["results"]
        
        try:
            logger.info(f"Performing {search_type} search for: {query}")
            
            with DDGS() as ddgs:
                if search_type == "news":
                    results = await self._search_news(ddgs, query, max_results)
                elif search_type == "academic":
                    results = await self._search_academic(ddgs, query, max_results)
                else:
                    results = await self._search_general(ddgs, query, max_results)
            
            # Cache results
            if use_cache:
                self._cache[cache_key] = {
                    "timestamp": datetime.now(),
                    "results": results
                }
            
            return results[:max_results]
            
        except Exception as e:
            logger.error(f"Web search failed for '{query}': {str(e)}")
            return []
    
    async def _search_general(
        self, 
        ddgs: DDGS, 
        query: str, 
        max_results: int
    ) -> List[SearchResult]:
        """Perform general web search."""
        results = []
        
        try:
            search_results = ddgs.text(
                query,
                max_results=max_results,
                timelimit="y"  # Results from past year
            )
            
            for item in search_results:
                result = SearchResult(
                    title=item.get("title", "")[:200],
                    snippet=item.get("body", "")[:500],
                    url=item.get("href", ""),
                    source=self._extract_source(item.get("href", "")),
                    relevance_score=0.0  # Will be calculated by RAG service
                )
                results.append(result)
                
        except Exception as e:
            logger.error(f"General search error: {str(e)}")
        
        return results
    
    async def _search_news(
        self, 
        ddgs: DDGS, 
        query: str, 
        max_results: int
    ) -> List[SearchResult]:
        """Perform news search."""
        results = []
        
        try:
            search_results = ddgs.news(
                query,
                max_results=max_results
            )
            
            for item in search_results:
                result = SearchResult(
                    title=item.get("title", "")[:200],
                    snippet=item.get("body", "")[:500],
                    url=item.get("url", ""),
                    source=item.get("source", "news"),
                    published_date=item.get("date"),
                    relevance_score=0.0
                )
                results.append(result)
                
        except Exception as e:
            logger.error(f"News search error: {str(e)}")
        
        return results
    
    async def _search_academic(
        self, 
        ddgs: DDGS, 
        query: str, 
        max_results: int
    ) -> List[SearchResult]:
        """Perform academic/scholarly search."""
        results = []
        
        try:
            # Academic search uses general search with site filters
            academic_query = f"{query} site:.edu OR site:.ac.id OR site:arxiv.org OR site:researchgate.net"
            search_results = ddgs.text(
                academic_query,
                max_results=max_results,
                timelimit="y"
            )
            
            for item in search_results:
                result = SearchResult(
                    title=item.get("title", "")[:200],
                    snippet=item.get("body", "")[:500],
                    url=item.get("href", ""),
                    source="academic",
                    relevance_score=0.0
                )
                results.append(result)
                
        except Exception as e:
            logger.error(f"Academic search error: {str(e)}")
        
        return results
    
    def _extract_source(self, url: str) -> str:
        """Extract source domain from URL."""
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            
            if "wikipedia" in domain:
                return "wikipedia"
            elif "news" in domain or "cnn" in domain or "bbc" in domain:
                return "news"
            elif ".edu" in domain or ".ac." in domain:
                return "academic"
            elif "gov" in domain:
                return "government"
            else:
                return domain.split(".")[-2] if "." in domain else "web"
        except:
            return "web"
    
    def clear_cache(self):
        """Clear the search cache."""
        self._cache.clear()
        logger.info("Web search cache cleared")
    
    async def search_for_module(
        self,
        module_topic: str,
        subtopics: List[str],
        max_results_per_subtopic: int = 3
    ) -> Dict[str, List[SearchResult]]:
        """
        Perform targeted searches for module generation.
        
        Args:
            module_topic: Main module topic
            subtopics: List of subtopics to search
            max_results_per_subtopic: Max results per subtopic
            
        Returns:
            Dictionary mapping subtopics to their search results
        """
        all_results = {}
        
        # Search for main topic
        main_results = await self.search(
            module_topic,
            search_type="general",
            max_results=max_results_per_subtopic
        )
        all_results["_main_topic"] = main_results
        
        # Search for each subtopic
        for subtopic in subtopics:
            query = f"{module_topic} {subtopic}"
            results = await self.search(
                query,
                search_type="academic",
                max_results=max_results_per_subtopic
            )
            all_results[subtopic] = results
        
        return all_results
