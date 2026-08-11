# Coding Standards

These standards apply to every new or modified file in the LMS and AI service.

## Naming

### Python

- Packages, modules, variables, parameters, and functions use `snake_case`.
- Classes, protocols, and Pydantic models use `PascalCase`.
- Constants use `UPPER_SNAKE_CASE`.
- Names describe their domain purpose. Prefer `generation_job_repository` over
  `repository`, and `module_plan_payload` over `data`.

### TypeScript and React

- Variables and functions use `camelCase`.
- React components, interfaces, and type aliases use `PascalCase`.
- React component files use `PascalCase.tsx`.
- Utility, service, and feature-support files use `kebab-case.ts`.
- Custom hooks begin with `use`.
- Avoid `any`; validate data at external boundaries.

## Structure and responsibilities

- A file has one primary responsibility.
- Route handlers validate transport input and delegate business logic.
- Services implement business behavior and do not render UI.
- Repositories own persistence and do not contain presentation logic.
- Schemas define request, response, and domain boundaries.
- React pages compose smaller feature components instead of mixing file
  validation, business logic, and large UI sections in one component.
- Code depends on interfaces or protocols when implementations will change.

## Comments and documentation

- Comments explain a non-obvious reason, safety rule, or tradeoff.
- Do not comment code that is already self-explanatory.
- Public or complex Python functions use concise docstrings.
- Remove obsolete comments and update documentation in the same change.
- Never include API keys, complete prompts, or private document content in logs.

## Error handling

- External input is validated before business logic runs.
- User-facing errors do not expose stack traces, provider details, or secrets.
- Internal failures include safe diagnostic context such as a job ID.
- Do not silently catch an exception unless failure is explicitly optional.

## Automated quality gates

Run these commands before considering an AI-service change complete:

```powershell
cd ai-service
.\.venv\Scripts\python.exe -m ruff format --check app tests scripts
.\.venv\Scripts\python.exe -m ruff check app tests scripts
.\.venv\Scripts\python.exe -m mypy app
.\.venv\Scripts\python.exe -m pytest -q
```

Run these commands for frontend or Next.js changes:

```powershell
pnpm run lint
.\node_modules\.bin\tsc.cmd --noEmit
pnpm run build
```

## Definition of done

A step is complete only when:

1. Naming and file placement follow this document.
2. External inputs and outputs have explicit schemas or types.
3. Relevant success, validation, and failure paths are tested.
4. Formatter, linter, type checker, and tests pass.
5. Documentation matches the implemented behavior.
6. No unrelated core LMS code was changed.
