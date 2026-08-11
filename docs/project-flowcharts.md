# LMS Project Flowcharts

These diagrams show the core application flow and the implemented fake AI job
lifecycle. They do not imply that a real model, RAG, web search, or presentation
generator is connected.

## AI draft-generation lifecycle

```mermaid
flowchart TD
    A["Instructor reviews request"] --> B["Next.js validates session and role"]
    B --> C["FastAPI creates owner-scoped queued job"]
    C --> D["Browser polls with capped backoff"]
    C --> E["Worker plans deterministic fake module"]
    D --> F{"Instructor cancels?"}
    F -- "Yes" --> G["Queued: cancel immediately\nProcessing: mark cancelling"]
    G --> H["Worker discards any late result"]
    H --> I["Cancelled"]
    F -- "No" --> J{"Worker outcome"}
    E --> J
    J -- "Valid plan" --> K["Completed preview"]
    J -- "Safe failure" --> L["Failed with retry"]
    L --> C
```

## 1. Overall request flow

```mermaid
flowchart LR
    User["User"] --> UI["React page"]
    UI --> Route["Next.js API route"]
    Route --> Service["Business service"]
    Service --> Prisma["Prisma ORM"]
    Prisma --> SQLite[("SQLite database")]
    SQLite --> Prisma --> Service --> Route --> UI
```

## 2. Authentication

```mermaid
flowchart TD
    Start["Open LMS"] --> Form["Login or registration form"]
    Form --> AuthRoute["Authentication API"]
    AuthRoute --> Validate{"Credentials valid?"}
    Validate -- "No" --> Error["Show validation error"]
    Validate -- "Yes" --> Session["Return user and session cookie"]
    Session --> Role{"User role"}
    Role -- "Employee" --> Employee["Employee dashboard"]
    Role -- "Instructor" --> Instructor["Instructor dashboard"]
    Role -- "Admin" --> Admin["Admin dashboard"]
```

## 3. Instructor creates a module

```mermaid
flowchart TD
    Dashboard["Instructor dashboard"] --> NewModule["New Module"]
    NewModule --> Details["Enter title and cover"]
    Details --> Save["Save draft module"]
    Save --> AddSection["Add lesson section"]
    AddSection --> Describe["Enter required lesson name and description"]
    Describe --> File["Upload 1–10 required PDF/PPT/PPTX files"]
    File --> Format{"PPT or PPTX?"}
    Format -- "Yes" --> Convert["Convert an internal PDF preview"]
    Format -- "No, PDF" --> Ready["Use uploaded PDF as preview"]
    Convert --> Ready
    Ready --> Lesson["Create lesson and deck records"]
    Lesson --> More{"Add another lesson?"}
    More -- "Yes" --> AddSection
    More -- "No" --> Publish["Publish module"]
    Publish --> Catalog["Module appears in catalog"]
```

## 4. Employee learning flow

```mermaid
flowchart TD
    Catalog["Browse catalog"] --> Detail["Open module details"]
    Detail --> Bookmark{"Bookmark only?"}
    Bookmark -- "Yes" --> Saved["Show in Bookmarked tab"]
    Bookmark -- "No" --> Enroll["Start training"]
    Enroll --> Lesson["Open first lesson"]
    Lesson --> DeckList["Show every uploaded deck as a titled panel"]
    DeckList --> Expand["Expand a deck"]
    Expand --> Preview["Render one clean slide in a horizontal carousel"]
    Preview --> Complete["Complete lesson"]
    Complete --> Last{"Last lesson?"}
    Last -- "No" --> Next["Unlock next lesson"] --> Lesson
    Last -- "Yes" --> Finished["Mark module completed"]
```

## 5. Progress tracking

```mermaid
flowchart LR
    Classroom["Classroom"] --> CompleteRoute["Complete lesson API"]
    CompleteRoute --> LessonProgress[("LessonProgress")]
    LessonProgress --> Calculate["Calculate completed lessons / total lessons"]
    Calculate --> Enrollment[("Enrollment progress")]
    Enrollment --> EmployeePage["My Training statistics"]
    Enrollment --> InstructorPage["Employee Progress report"]
```

## 6. Admin user management

```mermaid
flowchart TD
    Admin["Admin dashboard"] --> Users["User Management"]
    Users --> Search["Search users"]
    Search --> Edit["Open user editor"]
    Edit --> Validate["Validate name and role"]
    Validate --> Update["Update user through admin API"]
    Update --> Refresh["Refresh user table"]
```

## 7. Main data relationships

```mermaid
erDiagram
    USER ||--o{ COURSE : creates
    USER ||--o{ ENROLLMENT : has
    COURSE ||--o{ ENROLLMENT : receives
    USER ||--o{ BOOKMARK : saves
    COURSE ||--o{ BOOKMARK : bookmarked
    COURSE ||--o{ LESSON : contains
    USER ||--o{ LESSON_PROGRESS : completes
    LESSON ||--o{ LESSON_PROGRESS : records
```
