"""Typed adapter for EcoAPI's observed OpenAI-compatible chat endpoint."""

from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

import httpx
from pydantic import BaseModel, ConfigDict, Field, ValidationError

ChatRole = Literal["system", "user", "assistant", "tool"]


class EcoApiError(RuntimeError):
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


class EcoApiAuthenticationError(EcoApiError):
    """EcoAPI rejected the configured credential."""


class EcoApiAccessError(EcoApiError):
    """The credential cannot access the requested model or capability."""


class EcoApiRequestError(EcoApiError):
    """EcoAPI rejected a non-retryable request."""


class EcoApiRateLimitError(EcoApiError):
    """EcoAPI asked the caller to retry after rate limiting."""


class EcoApiTransientError(EcoApiError):
    """A timeout, network fault, or provider outage may succeed on retry."""


class EcoApiResponseError(EcoApiError):
    """EcoAPI returned a success payload that violated the observed contract."""


@dataclass(frozen=True)
class EcoApiCapabilities:
    """Capability results observed on 7 August 2026 for gpt-5.6-sol."""

    chat_completions: bool = True
    tool_calling: bool = True
    streaming: bool = True
    usage_metadata: bool = True
    structured_output_enforced: bool = False
    file_input_verified: bool = False


@dataclass(frozen=True)
class EcoApiChatMessage:
    """One text message sent to the provider."""

    role: ChatRole
    content: str


@dataclass(frozen=True)
class EcoApiToolCall:
    """Validated function call returned by EcoAPI."""

    id: str
    name: str
    arguments_json: str


@dataclass(frozen=True)
class EcoApiTokenUsage:
    """Token counts returned by EcoAPI when available."""

    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


@dataclass(frozen=True)
class EcoApiChatCompletion:
    """Provider-neutral subset required by the future module planner."""

    id: str
    model: str
    finish_reason: str
    content: str | None
    tool_calls: tuple[EcoApiToolCall, ...]
    usage: EcoApiTokenUsage | None


class _ProviderSchema(BaseModel):
    model_config = ConfigDict(extra="ignore")


class _EcoApiFunctionCall(_ProviderSchema):
    name: str = Field(min_length=1)
    arguments: str


class _EcoApiToolCallResponse(_ProviderSchema):
    id: str = Field(min_length=1)
    type: str
    function: _EcoApiFunctionCall


class _EcoApiAssistantMessage(_ProviderSchema):
    role: str
    content: str | None = None
    tool_calls: list[_EcoApiToolCallResponse] = Field(default_factory=list)


class _EcoApiChoice(_ProviderSchema):
    index: int
    message: _EcoApiAssistantMessage
    finish_reason: str


class _EcoApiUsageResponse(_ProviderSchema):
    prompt_tokens: int = Field(ge=0)
    completion_tokens: int = Field(ge=0)
    total_tokens: int = Field(ge=0)


class _EcoApiChatResponse(_ProviderSchema):
    id: str = Field(min_length=1)
    object: str
    model: str = Field(min_length=1)
    choices: list[_EcoApiChoice] = Field(min_length=1)
    usage: _EcoApiUsageResponse | None = None


class EcoApiClient:
    """Send non-streaming chat requests and normalize the observed response contract."""

    capabilities = EcoApiCapabilities()

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        timeout_seconds: float,
        http_client: httpx.Client | None = None,
    ) -> None:
        normalized_base_url = base_url.rstrip("/")
        if not normalized_base_url.endswith("/v1"):
            raise ValueError("EcoAPI base URL must end with /v1.")
        if not api_key.strip():
            raise ValueError("EcoAPI API key cannot be empty.")
        if not model.strip():
            raise ValueError("EcoAPI model cannot be empty.")

        self._chat_completions_url = normalized_base_url + "/chat/completions"
        self._api_key = api_key
        self._model = model
        self._http_client = http_client or httpx.Client(
            timeout=timeout_seconds,
            follow_redirects=False,
        )
        self._owns_http_client = http_client is None

    def close(self) -> None:
        """Close only the HTTP client created by this adapter."""

        if self._owns_http_client:
            self._http_client.close()

    def create_chat_completion(
        self,
        messages: Sequence[EcoApiChatMessage],
        *,
        tools: Sequence[dict[str, object]] = (),
        tool_choice: str | dict[str, object] | None = None,
        max_tokens: int | None = None,
        response_format: dict[str, object] | None = None,
    ) -> EcoApiChatCompletion:
        """Create one completion without claiming unsupported schema enforcement."""

        if not messages:
            raise ValueError("At least one EcoAPI chat message is required.")
        request_payload: dict[str, object] = {
            "model": self._model,
            "messages": [
                {"role": message.role, "content": message.content} for message in messages
            ],
            "stream": False,
        }
        if tools:
            request_payload["tools"] = list(tools)
        if tool_choice is not None:
            request_payload["tool_choice"] = tool_choice
        if max_tokens is not None:
            request_payload["max_tokens"] = max_tokens
        if response_format is not None:
            request_payload["response_format"] = response_format

        try:
            provider_response = self._http_client.post(
                self._chat_completions_url,
                headers={
                    "accept": "application/json",
                    "authorization": f"Bearer {self._api_key}",
                    "content-type": "application/json",
                },
                json=request_payload,
            )
        except httpx.TimeoutException as timeout_error:
            raise EcoApiTransientError(
                "The model provider timed out.",
                code="ECOAPI_TIMEOUT",
                retryable=True,
            ) from timeout_error
        except httpx.RequestError as request_error:
            raise EcoApiTransientError(
                "The model provider is unavailable.",
                code="ECOAPI_UNAVAILABLE",
                retryable=True,
            ) from request_error

        if not provider_response.is_success:
            self._raise_normalized_http_error(provider_response)

        try:
            parsed_response = _EcoApiChatResponse.model_validate(provider_response.json())
        except (ValueError, ValidationError) as response_error:
            raise EcoApiResponseError(
                "The model provider returned an invalid response.",
                code="ECOAPI_INVALID_RESPONSE",
                retryable=False,
            ) from response_error

        first_choice = parsed_response.choices[0]
        token_usage = (
            EcoApiTokenUsage(
                prompt_tokens=parsed_response.usage.prompt_tokens,
                completion_tokens=parsed_response.usage.completion_tokens,
                total_tokens=parsed_response.usage.total_tokens,
            )
            if parsed_response.usage
            else None
        )
        
        # Handle structured output via response_format (json_schema mode)
        # When using response_format with json_schema, some providers return the JSON in content directly
        content = first_choice.message.content
        
        return EcoApiChatCompletion(
            id=parsed_response.id,
            model=parsed_response.model,
            finish_reason=first_choice.finish_reason,
            content=content,
            tool_calls=tuple(
                EcoApiToolCall(
                    id=tool_call.id,
                    name=tool_call.function.name,
                    arguments_json=tool_call.function.arguments,
                )
                for tool_call in first_choice.message.tool_calls
            ),
            usage=token_usage,
        )

    @staticmethod
    def _raise_normalized_http_error(provider_response: httpx.Response) -> None:
        provider_code = EcoApiClient._read_provider_error_code(provider_response)
        response_status = provider_response.status_code
        if response_status == 401:
            raise EcoApiAuthenticationError(
                "The model provider rejected its credential.",
                code="ECOAPI_AUTHENTICATION_FAILED",
                retryable=False,
                provider_code=provider_code,
            )
        if response_status == 403:
            raise EcoApiAccessError(
                "The model provider denied access to the requested model.",
                code="ECOAPI_ACCESS_DENIED",
                retryable=False,
                provider_code=provider_code,
            )
        if response_status == 429:
            raise EcoApiRateLimitError(
                "The model provider is rate limiting requests.",
                code="ECOAPI_RATE_LIMITED",
                retryable=True,
                provider_code=provider_code,
            )
        if response_status in {408, 425} or response_status >= 500:
            raise EcoApiTransientError(
                "The model provider is temporarily unavailable.",
                code="ECOAPI_TRANSIENT_FAILURE",
                retryable=True,
                provider_code=provider_code,
            )
        raise EcoApiRequestError(
            "The model provider rejected the request.",
            code="ECOAPI_REQUEST_REJECTED",
            retryable=False,
            provider_code=provider_code,
        )

    @staticmethod
    def _read_provider_error_code(provider_response: httpx.Response) -> str | None:
        try:
            error_payload = provider_response.json()
        except ValueError:
            return None
        if not isinstance(error_payload, dict):
            return None
        error_details = error_payload.get("error")
        if not isinstance(error_details, dict):
            return None
        provider_code = error_details.get("code")
        return str(provider_code)[:100] if provider_code is not None else None
