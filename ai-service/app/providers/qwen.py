"""Typed adapter for local Qwen model via Ollama."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

import ollama
from pydantic import BaseModel, ConfigDict, Field, ValidationError

ChatRole = Literal["system", "user", "assistant", "tool"]


class QwenError(RuntimeError):
    """Base error containing only normalized, user-safe provider context."""

    def __init__(
        self,
        message: str,
        *,
        code: str,
        retryable: bool,
        provider_code: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.retryable = retryable
        self.provider_code = provider_code


class QwenAuthenticationError(QwenError):
    """Ollama rejected the configured credential."""


class QwenAccessError(QwenError):
    """The credential cannot access the requested model or capability."""


class QwenRequestError(QwenError):
    """Ollama rejected a non-retryable request."""


class QwenRateLimitError(QwenError):
    """Ollama asked the caller to retry after rate limiting."""


class QwenTransientError(QwenError):
    """A timeout, network fault, or provider outage may succeed on retry."""


class QwenResponseError(QwenError):
    """Ollama returned a success payload that violated the observed contract."""


@dataclass(frozen=True)
class QwenCapabilities:
    """Capability results for Qwen models."""

    chat_completions: bool = True
    tool_calling: bool = True
    streaming: bool = True
    usage_metadata: bool = True
    structured_output_enforced: bool = False
    file_input_verified: bool = False
    vision_support: bool = True  # Qwen supports image input


@dataclass(frozen=True)
class QwenChatMessage:
    """One text message sent to the provider."""

    role: ChatRole
    content: str


@dataclass(frozen=True)
class QwenToolCall:
    """Validated function call returned by Qwen."""

    id: str
    name: str
    arguments_json: str


@dataclass(frozen=True)
class QwenTokenUsage:
    """Token counts returned by Qwen when available."""

    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass(frozen=True)
class QwenChatCompletion:
    """Provider-neutral subset required by the future module planner."""

    id: str
    model: str
    finish_reason: str
    content: str | None
    tool_calls: tuple[QwenToolCall, ...]
    usage: QwenTokenUsage | None


class _ProviderSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")


class _QwenFunctionCall(_ProviderSchema):
    name: str = Field(min_length=1)
    arguments: str


class _QwenToolCallResponse(_ProviderSchema):
    id: str = Field(min_length=1)
    type: str
    function: _QwenFunctionCall


class _QwenAssistantMessage(_ProviderSchema):
    role: str
    content: str | None = None
    tool_calls: list[_QwenToolCallResponse] = Field(default_factory=list)


class _QwenChoice(_ProviderSchema):
    index: int
    message: _QwenAssistantMessage
    finish_reason: str


class _QwenUsageResponse(_ProviderSchema):
    prompt_tokens: int = Field(ge=0)
    completion_tokens: int = Field(ge=0)
    total_tokens: int = Field(ge=0)


class _QwenChatResponse(_ProviderSchema):
    id: str = Field(min_length=1)
    object: str
    model: str = Field(min_length=1)
    choices: list[_QwenChoice] = Field(min_length=1)
    usage: _QwenUsageResponse | None = None


class QwenClient:
    """Send non-streaming chat requests to local Ollama and normalize the response."""

    capabilities = QwenCapabilities()

    def __init__(
        self,
        *,
        base_url: str | None = None,
        api_key: str | None = None,
        model: str,
        timeout_seconds: float,
        http_client: object | None = None,
    ) -> None:
        if not model.strip():
            raise ValueError("Qwen model cannot be empty.")

        self._model = model
        self._timeout_seconds = timeout_seconds
        # Ollama client is stateless, we just use the library directly
        self._owns_http_client = True

    def close(self) -> None:
        """No-op for Ollama client."""
        pass

    def create_chat_completion(
        self,
        messages: Sequence[QwenChatMessage],
        *,
        tools: Sequence[dict[str, object]] = (),
        tool_choice: str | dict[str, object] | None = None,
        max_tokens: int | None = None,
    ) -> QwenChatCompletion:
        """Create one completion using local Ollama."""

        if not messages:
            raise ValueError("At least one Qwen chat message is required.")
        
        # Convert to Ollama format
        ollama_messages = [
            {"role": message.role, "content": message.content} for message in messages
        ]
        
        try:
            # Call Ollama
            response = ollama.chat(
                model=self._model,
                messages=ollama_messages,
                stream=False,
            )
            
            # Extract response
            message_content = response.get("message", {}).get("content", "")
            finish_reason = response.get("done_reason", "stop")
            model_name = response.get("model", self._model)
            
            # Extract usage if available
            usage_data = response.get("prompt_eval_count", 0)
            completion_tokens = response.get("eval_count", 0)
            
            token_usage = None
            if usage_data or completion_tokens:
                token_usage = QwenTokenUsage(
                    prompt_tokens=usage_data,
                    completion_tokens=completion_tokens,
                    total_tokens=usage_data + completion_tokens,
                )
            
            # Handle tool calls (simplified for Ollama)
            tool_calls = ()
            
            return QwenChatCompletion(
                id=f"ollama-{id(response)}",
                model=model_name,
                finish_reason=finish_reason,
                content=message_content,
                tool_calls=tool_calls,
                usage=token_usage,
            )
            
        except ollama.ResponseError as e:
            raise QwenRequestError(
                f"Ollama rejected the request: {str(e)}",
                code="OLLAMA_REQUEST_ERROR",
                retryable=False,
            ) from e
        except Exception as e:
            raise QwenTransientError(
                f"Ollama service unavailable: {str(e)}",
                code="OLLAMA_UNAVAILABLE",
                retryable=True,
            ) from e

    @staticmethod
    def _raise_normalized_http_error(provider_response: object) -> None:
        # Not used for Ollama
        pass

    @staticmethod
    def _read_provider_error_code(provider_response: object) -> str | None:
        # Not used for Ollama
        return None

