# EcoAPI Capability Probe

## Probe record

| Field | Value |
| --- | --- |
| Date | 7 August 2026 |
| Provider page | https://www.ecoapi.ai/ecoapi |
| Tested base URL | https://www.ecoapi.ai/v1 |
| Tested model | gpt-5.6-sol |
| Authentication | `Authorization: Bearer <server-side key>` |

The probe used short, non-sensitive prompts. The API key was read from the local
environment and was never printed. Results describe observed behavior rather
than assuming full compatibility with OpenAI APIs.

## Observed capabilities

| Capability | Result | Evidence |
| --- | --- | --- |
| Base URL | Verified | `/v1/chat/completions` is the working route. The provider documentation warns that `/api` produces HTTP 405 for OpenAI-compatible clients. |
| Missing authentication | Verified | A request without a bearer token returned HTTP 401. |
| Configured model | Verified | `gpt-5.6-sol` returned HTTP 200 and identified itself in the response. It is also listed on the provider model page. |
| Chat completion | Verified | The response contained `id`, `object`, `created`, `model`, `choices`, and `usage`. |
| Usage metadata | Verified | `prompt_tokens`, `completion_tokens`, and `total_tokens` were returned. |
| Tool calling | Verified | A required no-argument function returned `finish_reason: tool_calls` and a typed function call. |
| Streaming | Verified | `stream: true` returned `text/event-stream`, data events, and a `[DONE]` marker. |
| JSON Schema enforcement | Not supported by tested model | `response_format: json_schema` returned HTTP 200 but produced plain `OK`, not schema-valid JSON. |
| JSON object mode | Not supported by tested model | `response_format: json_object` was accepted but returned plain `OK`. |
| Error envelope | Verified | An inaccessible model returned HTTP 403 with `error.code`, `error.message`, and `error.type`. |
| Model-list API | Not verified | `GET /v1/models` returned the public HTML application rather than a JSON model list. |
| File input or upload | Not verified | No supported contract was exposed by the public integration documentation. |

## Implementation decisions

- The adapter requires a base URL ending in `/v1` and disables redirects so an
  authentication header cannot be lost during a hostname redirect.
- Credentials remain `SecretStr` server configuration and are never included in
  adapter exceptions.
- HTTP errors are normalized into authentication, access, request, rate-limit,
  transient, and invalid-response categories with an explicit `retryable` flag.
- Successful responses are validated before business logic receives them.
- The adapter exposes tool calls and token usage but does not claim that
  structured output is enforced.
- Phase 7 must request JSON in the prompt, validate it with the existing Pydantic
  schema, and use bounded repair or retry. A 200 response alone is not valid
  structured output.
- The background worker remains on `FakeModuleGenerator` until Phase 7 provides
  and tests real structured module planning.

## Still requiring production validation

- Rate-limit headers and recommended retry delay.
- Provider latency and timeout thresholds under realistic module prompts.
- Context-window and output-token limits for the selected model.
- Complex and multi-step tool calls.
- File, image, and document input support.
- The provider's zero-retention and compliance claims through contractual or
  security review rather than marketing material alone.
- Tenant approval to transmit prompts or reference content to a third party.
