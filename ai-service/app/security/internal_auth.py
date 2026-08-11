"""Authenticate requests sent by the trusted Next.js LMS service."""

from dataclasses import dataclass
from hmac import compare_digest
from typing import Annotated, cast

from fastapi import Header, HTTPException, Request, status

from app.config import AiServiceSettings

INTERNAL_API_KEY_HEADER = "X-Lumen-Internal-Key"
INTERNAL_USER_ID_HEADER = "X-Lumen-User-Id"
MAXIMUM_USER_ID_LENGTH = 128


@dataclass(frozen=True)
class InternalRequestContext:
    """Identity asserted by Next.js after it validates the browser session."""

    user_id: str


def require_internal_request(
    request: Request,
    provided_api_key: Annotated[
        str | None,
        Header(alias=INTERNAL_API_KEY_HEADER),
    ] = None,
    provided_user_id: Annotated[
        str | None,
        Header(alias=INTERNAL_USER_ID_HEADER),
    ] = None,
) -> InternalRequestContext:
    """Reject direct browser calls and return the trusted LMS user identity."""

    ai_service_settings = cast(AiServiceSettings, request.app.state.ai_service_settings)
    expected_api_key = ai_service_settings.internal_api_key.get_secret_value()
    if provided_api_key is None or not compare_digest(provided_api_key, expected_api_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid internal service credentials.",
        )

    normalized_user_id = provided_user_id.strip() if provided_user_id else ""
    if not normalized_user_id or len(normalized_user_id) > MAXIMUM_USER_ID_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A valid internal user ID is required.",
        )

    return InternalRequestContext(user_id=normalized_user_id)
