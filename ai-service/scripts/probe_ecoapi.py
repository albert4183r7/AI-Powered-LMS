"""Run one redacted EcoAPI smoke probe using AI service environment settings."""

import json

from app.config import get_ai_service_settings
from app.providers.ecoapi import EcoApiChatMessage, EcoApiClient, EcoApiError


def main() -> int:
    """Verify authentication and the basic chat response without printing secrets."""

    settings = get_ai_service_settings()
    if settings.ecoapi_api_key is None:
        print(json.dumps({"ok": False, "reason": "AI_SERVICE_ECOAPI_API_KEY is missing."}))
        return 2

    ecoapi_client = EcoApiClient(
        base_url=settings.ecoapi_base_url,
        api_key=settings.ecoapi_api_key.get_secret_value(),
        model=settings.ecoapi_chat_model,
        timeout_seconds=settings.ecoapi_request_timeout_seconds,
    )
    try:
        completion = ecoapi_client.create_chat_completion(
            [EcoApiChatMessage(role="user", content="Reply with exactly OK.")],
            max_tokens=8,
        )
    except EcoApiError as provider_error:
        print(
            json.dumps(
                {
                    "ok": False,
                    "code": provider_error.code,
                    "retryable": provider_error.retryable,
                }
            )
        )
        return 1
    finally:
        ecoapi_client.close()

    print(
        json.dumps(
            {
                "ok": completion.content == "OK",
                "model": completion.model,
                "finish_reason": completion.finish_reason,
                "usage_present": completion.usage is not None,
            }
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
