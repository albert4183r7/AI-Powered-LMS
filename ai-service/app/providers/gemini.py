"""Typed adapter for Google Gemini API using google-genai SDK."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from google import genai
from google.genai import types

ChatRole = Literal["system", "user", "assistant", "tool"]


class GeminiError(RuntimeError):
    """Base error for Gemini API."""
    pass


class GeminiTransientError(GeminiError):
    """A retryable error."""
    pass


@dataclass(frozen=True)
class GeminiTokenUsage:
    """Token counts returned by Gemini."""

    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass(frozen=True)
class GeminiChatCompletion:
    """Provider-neutral subset required by the module planner."""

    id: str
    model: str
    finish_reason: str
    content: str | None
    usage: GeminiTokenUsage | None


class GeminiClient:
    """Send chat requests to Google Gemini."""

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
    ) -> None:
        if not api_key:
            raise ValueError("Gemini API key is required.")
        if not model.strip():
            raise ValueError("Gemini model cannot be empty.")

        self._model = model
        self._client = genai.Client(api_key=api_key)

    def close(self) -> None:
        """No-op for Gemini client."""
        pass

    def create_chat_completion(
        self,
        messages: Sequence[object],
        *,
        max_tokens: int | None = None,
    ) -> GeminiChatCompletion:
        """Create one completion using Gemini API."""
        
        system_instruction = None
        gemini_contents = []

        for message in messages:
            role = getattr(message, "role", "user")
            content = getattr(message, "content", "")
            
            if role == "system":
                system_instruction = content
            elif role == "assistant":
                gemini_contents.append(
                    types.Content(role="model", parts=[types.Part.from_text(text=content)])
                )
            else:
                gemini_contents.append(
                    types.Content(role="user", parts=[types.Part.from_text(text=content)])
                )

        config = types.GenerateContentConfig(
            system_instruction=system_instruction,
            max_output_tokens=max_tokens,
            temperature=0.2,
        )

        try:
            response = self._client.models.generate_content(
                model=self._model,
                contents=gemini_contents,
                config=config,
            )

            token_usage = None
            if response.usage_metadata:
                token_usage = GeminiTokenUsage(
                    prompt_tokens=response.usage_metadata.prompt_token_count,
                    completion_tokens=response.usage_metadata.candidates_token_count,
                    total_tokens=response.usage_metadata.total_token_count,
                )

            return GeminiChatCompletion(
                id="gemini",
                model=self._model,
                finish_reason="stop",
                content=response.text,
                usage=token_usage,
            )

        except Exception as e:
            raise GeminiTransientError(f"Gemini API error: {str(e)}") from e

    def create_text_embeddings(
        self,
        texts: list[str],
        *,
        model: str = "text-embedding-004",
    ) -> list[list[float]]:
        """Create text embeddings using Gemini API."""
        if not texts:
            return []

        try:
            response = self._client.models.embed_content(
                model=model,
                contents=texts,
            )
            
            # The SDK returns a list of embedding objects, each having a 'values' attribute (list of floats)
            if not getattr(response, "embeddings", None):
                # If only one text is passed, or SDK returns differently
                if hasattr(response, "values"):
                    return [response.values]
                if hasattr(response, "embedding"):
                    return [response.embedding.values]
                raise GeminiError("Unexpected response format from embedding API.")
                
            return [e.values for e in response.embeddings]
            
        except Exception as e:
            raise GeminiTransientError(f"Gemini API error: {str(e)}") from e
