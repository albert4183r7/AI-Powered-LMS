"""Service for gathering contextual information from the web."""

import logging
from ddgs import DDGS

LOGGER = logging.getLogger(__name__)


class WebSearchService:
    """Uses DuckDuckGo Search to fetch web content to augment generation contexts."""

    def __init__(self, max_results: int = 3) -> None:
        self._max_results = max_results

    def search(self, query: str) -> str:
        """
        Execute a web search and format the results as a context string.
        Returns an empty string if the search fails.
        """
        if not query.strip():
            return ""

        LOGGER.info("Executing web search for query: %s", query)
        try:
            with DDGS() as ddgs:
                results = list(ddgs.text(query, max_results=self._max_results))
                
            if not results:
                return ""
                
            formatted_results = ["--- WEB SEARCH RESULTS ---"]
            for idx, result in enumerate(results, 1):
                title = result.get("title", "No Title")
                href = result.get("href", "No URL")
                body = result.get("body", "No content available.")
                formatted_results.append(f"Source {idx}: {title} ({href})\n{body}\n")
                
            return "\n".join(formatted_results)
        except Exception as search_error:
            LOGGER.error(
                "Web search failed for query '%s': %s",
                query,
                search_error,
            )
            return ""
