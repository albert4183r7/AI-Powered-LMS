# Lumen LMS — Product Requirements Document

## 1. Document control

| Field | Value |
| --- | --- |
| Product | Lumen Enterprise Learning Management System |
| Document type | Product Requirements Document (PRD) |
| Version | 1.0 |
| Status | As-built core baseline with production requirements |
| Date | 6 August 2026 |
| Audience | Product owner, designer, frontend developer, backend developer, QA, and future AI engineer |

## 2. Executive summary

Lumen is an internal enterprise learning management system for creating, delivering, and tracking structured employee training. Instructors create modules and lessons, employees discover and complete training, and administrators manage user roles.

The core product is intentionally a conventional full-stack LMS and remains independent from AI infrastructure. An isolated experimental Python service now provides contracts, persistent background jobs, and a fake generator, but no real model provider is called yet. The approved requirements and mandatory implementation sequence are defined in the [AI Product Requirements Document](ai-product-requirements-document.md).

## 3. Problem statement

Organizations need a simple internal platform to:

- centralize training modules;
- allow instructors to maintain learning content without engineering support;
- let employees discover, bookmark, and complete training;
- enforce an ordered lesson sequence;
- measure learner progress; and
- give administrators basic control over users and roles.

Without a shared system, training content is scattered across files and communication tools, completion is difficult to verify, and instructors cannot reliably understand learner progress.

## 4. Product vision

Provide a clear, low-friction enterprise training experience that lets an employee move from discovery to completion while giving instructors and administrators the minimum tools needed to operate the training catalog.

## 5. Goals

### 5.1 Product goals

1. Make published training easy for employees to discover.
2. Let instructors create and maintain modules without editing code.
3. Track lesson and module completion accurately.
4. Give instructors visibility into employee progress.
5. Give administrators a simple interface for user and role management.
6. Keep the core LMS independent from future AI functionality.

### 5.2 Proposed success metrics

These metrics are product targets; analytics collection is not yet implemented.

| Metric | Initial target |
| --- | --- |
| Successful sign-in rate | At least 98% excluding incorrect credentials |
| Published module start rate | At least 40% of module-detail visits |
| Module completion rate | At least 60% of started mandatory modules |
| Instructor module publishing success | At least 95% without support intervention |
| API error rate | Below 1% for valid requests |
| Core page load time | Under 2.5 seconds on a typical corporate connection |

## 6. Users and roles

### 6.1 Employee

An employee wants to discover relevant training, save modules for later, start training, progress through lessons, and see completed work.

Primary capabilities:

- browse and search published modules;
- bookmark a module;
- enroll in a module;
- open lessons in sequence;
- complete lessons;
- download presentation material;
- view in-progress and completed training; and
- update their display name.

### 6.2 Instructor

An instructor wants to publish organized training material and monitor learner progress.

Primary capabilities:

- perform normal catalog and profile activities;
- create a draft module;
- edit module title and cover;
- add, edit, delete, and reorder lessons;
- upload PDF, PPT, or PPTX material;
- publish or unpublish a module;
- delete a module; and
- view learner progress for owned modules.

### 6.3 Administrator

An administrator wants to maintain platform access and user roles.

Primary capabilities:

- view and search users;
- edit a user's display name;
- change a user's role; and
- access instructor-level module management.

## 7. Scope

### 7.1 In scope for the core LMS

- email and password registration and sign-in;
- employee, instructor, and administrator roles;
- published module catalog;
- first-letter/prefix title search;
- category and date filters;
- popular, recent, and alphabetical sorting;
- bookmarks;
- enrollments;
- ordered lessons;
- lesson completion and module progress;
- instructor module and lesson management;
- a learner-facing lesson description and 1–10 required presentation attachments per new lesson;
- classroom access to the original uploaded presentation files;
- instructor progress reporting;
- administrator user management;
- English and Mandarin UI text; and
- responsive desktop and mobile layouts.

### 7.2 Explicitly out of scope

- quizzes and assessments;
- video lessons;
- voice input;
- certificates;
- payments, subscriptions, and billing;
- public marketplace functionality;
- organization/tenant isolation;
- email notifications;
- SCORM or xAPI integration;
- live classes;
- social discussion features;
- AI course generation;
- AI chat assistants;
- RAG, embeddings, vector databases, and agent tool calling; and
- native mobile applications.

### 7.3 Separate AI scope

AI-assisted module creation is specified separately in the [AI Product Requirements Document](ai-product-requirements-document.md). That document covers user value, the approved workflow, provider capability checks, tool permissions, document ingestion, RAG, data retention, guardrails, evaluation, observability, cost controls, failure handling, and human approval. AI functionality remains outside the core LMS scope described by this document.

## 8. Information architecture

The baseline behaves as a single-page application with the following logical views:

| View | Main audience | Purpose |
| --- | --- | --- |
| Authentication | All users | Sign in or register |
| Dashboard | All signed-in users | Discover highlighted training |
| Catalog | All signed-in users | Search and filter published modules |
| My Training | Employee | View in-progress, completed, and bookmarked modules |
| Module Details | Employee/Instructor/Admin | View lessons, start training, bookmark, or inspect progress |
| Classroom | Employee/Instructor/Admin | View uploaded presentation files and navigate lessons |
| My Modules | Instructor/Admin | Manage owned modules |
| Module Editor | Instructor/Admin | Edit module metadata and lessons |
| Profile | All signed-in users | View account information and update display name |
| User Management | Admin | Search users and update names or roles |

## 9. Functional requirements

### 9.1 Authentication and account management

| ID | Requirement | Acceptance criteria | Baseline status |
| --- | --- | --- | --- |
| AUTH-01 | A user can sign in with email and password. | Valid credentials open the dashboard; invalid credentials return a generic 401 error. | Implemented |
| AUTH-02 | A user can register as an employee or instructor. | Email is normalized; duplicate email returns 409; password requires at least six characters. | Implemented |
| AUTH-03 | Passwords must be stored as salted hashes. | Newly created passwords use scrypt and are never returned by an API. | Implemented |
| AUTH-04 | Navigation must reflect the signed-in role. | Employee, instructor, and admin see only their relevant navigation items. | Implemented in UI |
| AUTH-05 | A user can sign out. | Sign-out clears authenticated state and returns to the authentication view. | Implemented in client state |
| AUTH-06 | Production authentication must use a server-verifiable session. | Protected APIs reject missing/invalid sessions and do not trust a client-supplied user ID or role. | Production gap |
| AUTH-07 | Sessions must survive a normal page refresh until expiry or sign-out. | Refresh does not unexpectedly sign out an active user. | Production gap |

### 9.2 Catalog and discovery

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| CAT-01 | Users can view published modules. | Draft modules never appear in the public catalog response. |
| CAT-02 | Users can search by title prefix. | Searching `i` returns titles beginning with `i`, case-insensitively; a title such as `AAA Invest` is excluded. |
| CAT-03 | Users can filter by category. | Selecting a category returns only published modules in that category. |
| CAT-04 | Users can filter by recency. | Last Week and Last Month apply the expected creation-date boundary. |
| CAT-05 | Users can sort modules. | Popular uses learner count, Recent uses creation date, and Alphabetical uses the module title. |
| CAT-06 | The catalog displays useful summary information. | Each card shows title, category, lesson count, learner count, cover, and bookmark state. |
| CAT-07 | Empty and error states are clear. | No-result searches and failed requests show understandable messages without breaking the page. |

### 9.3 Bookmarks and enrollment

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| ENR-01 | An employee can bookmark a published module. | Repeated bookmark requests do not create duplicate records. |
| ENR-02 | An employee can remove a bookmark. | The bookmarked tab and course card update after removal. |
| ENR-03 | An employee can enroll in a published module. | Enrollment creates an in-progress record; non-employees receive 403. |
| ENR-04 | Draft modules cannot be enrolled in. | The API rejects enrollment with a conflict response. |
| ENR-05 | Bookmark state is independent from learning status. | Completing a module does not automatically remove its bookmark. |

### 9.4 Learning and progress

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| LRN-01 | An enrolled employee can open a lesson. | The lesson's uploaded presentations load without exposing unpublished modules to unauthorized users. |
| LRN-02 | Lessons are completed sequentially. | A later lesson cannot be completed before the previous lesson. |
| LRN-03 | Completing a lesson is idempotent. | Repeating completion does not create duplicate LessonProgress records. |
| LRN-04 | Module progress is calculated from completed lessons. | Progress equals rounded completed lessons divided by total lessons. |
| LRN-05 | Completing every lesson completes the module. | Enrollment changes from in-progress to completed at 100%. |
| LRN-06 | The classroom displays every lesson deck. | Every uploaded attachment appears as a titled expandable panel. Expanding a panel shows one slide at a time in a horizontal carousel; Previous and Next move left or right without displaying the browser PDF toolbar. |
| LRN-07 | Users can access original lesson material. | PDF files are rendered directly; PPT/PPTX files use converted PDF previews while the unchanged originals remain downloadable. The system never generates substitute lesson content. |
| LRN-08 | My Training separates learning states. | In-progress, completed, and bookmarked tabs show the correct records. |

### 9.5 Instructor module management

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| INS-01 | An instructor can create a draft module. | A title and valid author are required; the new module starts as draft. |
| INS-02 | Duplicate module titles are prevented per instructor. | A conflicting non-empty module returns 409. |
| INS-03 | An instructor can update module metadata. | Supported title, cover, and status changes persist and refresh the UI. |
| INS-04 | An instructor can add a manual lesson. | Lesson name and description are required, the name is unique within the module, and one to ten presentation files must be attached. |
| INS-05 | An instructor can edit or delete a lesson. | Changes persist; deleting the last lesson returns the module to draft. |
| INS-06 | An instructor can reorder lessons. | Up/down swaps lesson order; moving beyond an edge returns a clear conflict. |
| INS-07 | Empty modules cannot be published. | Publish returns 409 until at least one lesson with an uploaded presentation exists. |
| INS-08 | An instructor can delete a module. | Related lessons, enrollments, and progress are removed through database cascades. |
| INS-09 | The module list shows capacity. | The response reports used modules and the configured maximum of ten. |
| INS-10 | Production authorization verifies ownership. | An instructor cannot update or delete a module owned by another instructor. | 

### 9.6 Presentation files

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| FILE-01 | Instructors must attach PDF, PPT, or PPTX material to every new lesson. | Creation is rejected unless the lesson has between one and ten attachments; other extensions return 400. |
| FILE-02 | Upload size is limited to 200 MB per file. | Larger files return 413 before persistence. |
| FILE-03 | Stored names are collision-resistant. | Server generates a timestamp plus random UUID fragment. |
| FILE-04 | File retrieval prevents path traversal. | Resolved paths outside the uploads directory are rejected. |
| FILE-05 | Production validates actual file content. | MIME type/signature is checked rather than extension alone. | 
| FILE-06 | Deleted or replaced files are cleaned up. | Orphan presentation files do not accumulate indefinitely. | 
| FILE-07 | Uploaded presentations are the only classroom content source. | The lesson model stores no generated slide JSON; file counts and classroom content come directly from LessonPresentation records. |
| FILE-08 | PowerPoint files have browser-compatible previews. | A valid PPT/PPTX upload is converted to PDF by LibreOffice or Microsoft PowerPoint. Conversion failure returns a clear 422 response and does not create a broken lesson attachment. |

### 9.7 Instructor reporting

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| RPT-01 | An instructor can view learners for a module. | Report contains employee name, email, status, enrollment date, and completion percentage. |
| RPT-02 | Report summaries are correct. | Total enrolled, total completed, and average progress match learner rows. |
| RPT-03 | Only employee enrollments are counted. | Instructor and admin records are excluded from learner reporting. |

### 9.8 Administration

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| ADM-01 | An administrator can list and search users. | Search matches user name or email. |
| ADM-02 | An administrator can update a display name. | Empty names are rejected and valid changes persist. |
| ADM-03 | An administrator can change a user role. | Only admin, instructor, and employee are accepted. |
| ADM-04 | User summaries include activity counts. | Each row includes courses created and enrollment count. |
| ADM-05 | Production restricts admin APIs to admins. | Non-admin sessions receive 403 for list and update operations. |

### 9.9 Localization and responsive design

| ID | Requirement | Acceptance criteria |
| --- | --- | --- |
| UX-01 | Users can switch between English and Mandarin. | Supported interface labels change without reloading. |
| UX-02 | Layouts work on desktop and mobile. | Primary navigation, forms, cards, modal dialogs, and classroom remain usable at common breakpoints. |
| UX-03 | Interactive elements are keyboard accessible. | Buttons, tabs, form fields, dialogs, and select controls have accessible names and focus behavior. |
| UX-04 | Loading, empty, success, and failure states are visible. | Users receive feedback for every network-dependent action. |

## 10. Business rules

1. Only published modules appear in the learner catalog.
2. Only employees can enroll in or complete training.
3. Bookmark records are independent from learning-state records.
4. A user can have only one enrollment and one bookmark for a given course.
5. A user can complete each lesson only once.
6. Lessons must be completed in order.
7. A module with no lessons cannot be published.
8. Deleting the final lesson changes a module back to draft.
9. Module titles must be unique per instructor.
10. Lesson titles must be unique within a module.
11. Instructor module capacity is currently ten modules.

## 11. Data requirements

### 11.1 User

Required data: ID, unique email, password hash, role, created date, and updated date. Name is optional.

### 11.2 Course

Required data: ID, title, category, status, language, created date, and updated date. Description, cover, and author are optional in the current schema but should be required or deliberately defaulted for production.

### 11.3 Lesson

Required data: ID, title, order, course ID, created date, and updated date. New or edited lessons require a non-empty description at the API layer. The database column remains nullable only for legacy records. Every newly created lesson must own between one and ten LessonPresentation records; legacy seeded lessons with no attachment show a clear empty state until an instructor edits them.

### 11.4 Lesson presentation

Required data: ID, original file name, stored file path, display order, lesson ID, and creation date. A PDF preview path is optional for legacy records and populated when a preview is created. Deleting a lesson must cascade to its presentation metadata records.

### 11.5 Enrollment

Required data: user ID, course ID, status, progress, enrollment time, optional completion time, and updated time. The user and course combination must be unique. `completedAt` is null while the enrollment is in progress and records the first course-completion time after completion.

### 11.6 Bookmark

Required data: user ID, course ID, and creation time. The user and course combination must be unique. Bookmark records are independent from enrollment records so an employee can save a course before enrolling.

### 11.7 Lesson progress

Required data: user ID, lesson ID, and completion time. The user and lesson combination must be unique.

## 12. API conventions

1. Successful JSON APIs return the requested entity or result with a suitable 2xx status.
2. Validation errors return 400 with `error` and `code`.
3. Authentication failures return 401.
4. Authorization failures return 403.
5. Missing records return 404.
6. Duplicate or invalid-state operations return 409.
7. Oversized uploads return 413.
8. Unexpected errors return 500 without exposing stack traces or secrets.
9. Production endpoints must derive current user identity from the server session.
10. Mutating endpoints must validate role and resource ownership.

## 13. Non-functional requirements

### 13.1 Security

- Passwords must be salted and hashed.
- Protected routes must use server-side authentication and authorization.
- Client-supplied user IDs and roles must never be treated as proof of identity.
- Uploads must enforce extension, MIME type, signature, size, and safe path handling.
- Rate limits must protect sign-in, registration, and uploads.
- Security-sensitive actions should create audit events.
- Production secrets must be stored outside source control.

### 13.2 Performance

- Catalog queries should avoid per-course database query loops.
- Large lists should support pagination before production scale.
- Presentation generation must have timeout and memory limits.
- Images and presentation downloads should use appropriate caching headers.

### 13.3 Reliability

- Multi-record state changes must use database transactions.
- Repeated enrollment, bookmark, and completion requests must be idempotent.
- User-facing errors must remain understandable when the database or filesystem is unavailable.
- Production must have database backups and a tested restore procedure.

### 13.4 Maintainability

- UI components must not directly access Prisma.
- API routes should validate requests and delegate business logic to services.
- Shared request and response types should remain in feature folders.
- Complex business rules require comments and automated tests.
- AI code must be isolated from core LMS services when introduced.

### 13.5 Accessibility

- Target WCAG 2.1 AA.
- Maintain sufficient color contrast.
- Provide keyboard operation and visible focus states.
- Use semantic labels for inputs, buttons, tabs, tables, and dialogs.
- Do not communicate state using color alone.

## 14. Current technical architecture

| Layer | Current technology |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| UI primitives | Radix UI/shadcn-style components |
| Client state | Zustand |
| Backend | Next.js Route Handlers |
| Business logic | TypeScript services |
| ORM | Prisma |
| Database | SQLite |
| Presentation rendering | PptxGenJS |
| Presentation storage | Local filesystem |

The browser calls Next.js APIs. API routes validate input and call services. Services read or update SQLite through Prisma. The browser must never access Prisma or the database directly.

## 15. Known baseline gaps

The following gaps must not be mistaken for completed production requirements:

1. Authentication exists, but there is no server session, JWT, or protected-route middleware.
2. The frontend user state is memory-only and is lost on refresh.
3. Several APIs trust `userId` or `role` from request data.
4. Ownership checks are not consistently enforced for instructor changes.
5. Admin endpoints are not protected by server-side admin authorization.
6. Upload validation relies mainly on extension and size.
7. Local SQLite and local uploads are suitable for development, not horizontally scaled deployment.
8. Automated unit, integration, and end-to-end tests are not yet present.
9. Analytics, monitoring, audit logs, rate limiting, and backups are not implemented.
10. Documentation currently mentions Zod, while the code uses custom validation helpers.

## 16. Release plan

### Phase 1 — Core prototype

Status: implemented.

- roles and account forms;
- catalog and bookmarks;
- module creation and lesson management;
- enrollment and completion;
- progress reporting;
- admin user editing;
- presentation upload/download; and
- responsive bilingual UI.

### Phase 2 — Production-ready core SaaS

Required before a production AI release:

- server-side sessions;
- API authorization and ownership checks;
- persistent login;
- production database strategy;
- object storage for uploads;
- MIME/signature validation;
- automated tests;
- monitoring and audit logs;
- rate limiting;
- pagination; and
- deployment and backup procedures.

### Phase 3 — AI discovery and PRD

- status: the dedicated AI PRD is approved, while instructor interviews and evaluation work remain ongoing;
- interview target instructors;
- define the exact AI-assisted workflow;
- decide what requires human approval;
- define provider, tool, RAG, security, retention, and cost requirements;
- establish evaluation datasets and success thresholds; and
- maintain the approved [AI Product Requirements Document](ai-product-requirements-document.md) as implementation decisions evolve.

### Phase 4 — Controlled AI implementation

Status: foundation in progress. FastAPI contracts and fake background jobs exist, but no real model provider, RAG, web search, or presentation tool is integrated. Production activation still requires the Phase 2 security controls and all AI PRD acceptance criteria.

## 17. Core release acceptance scenarios

1. A new employee registers, signs in, searches by title prefix, bookmarks a module, enrolls, completes lessons in order, and sees the module in Completed.
2. An instructor signs in, creates a draft module, adds two lessons, uploads a presentation, reorders lessons, publishes the module, and sees learner progress.
3. The system prevents publishing an empty module.
4. The system prevents completing lesson two before lesson one.
5. The system preserves a bookmark after module completion.
6. An administrator searches for a user and changes the user's role.
7. Unsupported or oversized presentation uploads are rejected.
8. An invalid upload path cannot access files outside the uploads directory.
9. In production, an employee cannot call admin or instructor mutation APIs.
10. In production, an instructor cannot edit another instructor's module.

## 18. Open product decisions

The product owner should decide these before production implementation:

1. Is Lumen single-company or multi-tenant SaaS?
2. Can users self-register, or must admins/invitations create accounts?
3. Can an instructor view all employee progress or only progress in owned modules?
4. Should administrators be able to delete or deactivate users?
5. Are modules optional, assigned, or mandatory by department?
6. Does module completion expire or require renewal?
7. Are uploaded presentations private to signed-in users?
8. Should Mandarin translate only interface text or also course content?
9. Is the ten-module instructor limit a real business rule or a prototype limit?
10. What analytics and audit retention are required?
11. Which evaluation dataset and instructor pilot group should approve the combined module planning, presentation generation, and document-grounded workflow?

## 19. Definition of done

A requirement is complete only when:

- its acceptance criteria pass;
- role and ownership rules are enforced on the server;
- loading, empty, success, and failure states are handled;
- accessibility has been checked;
- tests cover the important success and failure paths;
- documentation matches the implementation; and
- no unrelated AI behavior is added without an approved AI PRD.
