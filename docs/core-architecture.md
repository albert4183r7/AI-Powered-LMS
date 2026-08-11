# Core LMS Architecture

## 1. The simple mental model

Lumen has three main layers:

1. React components display pages and collect user input.
2. Next.js API routes validate HTTP requests and call a service.
3. Services use Prisma to read or write the SQLite database.

The browser never accesses Prisma or the database directly.

## 2. Frontend

`src/app/page.tsx` is the SPA entry point. It selects a page component from the current Zustand state.

`src/components/training` contains the actual LMS screens:

- `AuthPage` handles login and registration.
- `HomePage` and `CoursesPage` display the catalog.
- `MyLearningPage` displays enrolled, completed, and bookmarked modules.
- `MyCoursesPage` lists modules owned by an instructor.
- `CreateCoursePage` edits a module and its lesson order.
- `AddSectionModal` collects the required lesson name, required description, and presentation uploads in a viewport-bounded form.
- `CourseDetailPage` displays lessons and employee progress.
- `SlideClassroom` displays uploaded presentation material and records completion.
- `AdminPage` manages users and roles.

`src/store/app-store.ts` stores navigation and editor state only. Server data is loaded from APIs when a page needs it.

## 3. Backend

Route handlers live in `src/app/api`. They should do four small jobs:

1. Read route parameters and the request body.
2. Validate values.
3. Call a service or a focused database operation.
4. Return a consistent JSON response and HTTP status.

Reusable business rules live in `src/server/services`:

- `catalog-service.ts` handles catalog queries and course details.
- `course-management-service.ts` handles course and lesson changes.
- `enrollment-service.ts` handles bookmarks, enrollments, completion, and progress.
- `user-service.ts` handles authentication profiles and admin updates.

## 4. Database

Prisma models seven concepts:

- `User`: account, role, and profile.
- `Course`: training module and publishing state.
- `Lesson`: an ordered lesson with a learner-facing description and presentation attachments.
- `LessonPresentation`: one of the presentation files attached to a lesson.
- `Enrollment`: one learner's progress and learning state for a course.
- `Bookmark`: a course saved by an employee independently from enrollment.
- `LessonProgress`: completed lessons for a user.

The SQLite file is `db/custom.db`.

## 5. Presentation handling

An instructor must attach between 1 and 10 PDF, PPT, or PPTX files when creating a lesson through `/api/upload`. Files are stored in `uploads`, represented by `LessonPresentation` records, and served through the guarded uploads route.

The classroom lists every attachment as an expandable deck. PDF.js draws each PDF page onto a canvas inside a horizontal carousel, so one slide is visible at a time and the next slide moves in from the right. Learners see only the slide rather than the browser's PDF toolbar. PPT/PPTX uploads are converted to an internal PDF preview by LibreOffice or Microsoft PowerPoint; the uploaded original remains unchanged and available for download. A same-named PDF attachment can act as the preview for a PowerPoint attachment. The application never invents substitute lesson slides.

`src/server/presentations/presentation-preview.ts` owns safe upload-path resolution, serialized conversion, and preview naming. `/api/presentations/:id/preview` returns the PDF used by the slide renderer and lazily converts legacy PowerPoint attachments when needed.

## 6. Authorization boundaries

- Employees browse, bookmark, enroll, learn, and complete lessons.
- Instructors also create modules and review employee progress.
- Admins also manage users and roles.

Authentication identifies the current user. API operations must validate the requested record and role before changing data.

## 7. Where to start reading

For a beginner, follow this order:

1. `prisma/schema.prisma`
2. `src/app/page.tsx`
3. `src/store/app-store.ts`
4. `src/components/training/HomePage.tsx`
5. `src/app/api/courses/route.ts`
6. `src/server/services/catalog-service.ts`
7. `src/components/training/CreateCoursePage.tsx`
8. `src/server/services/course-management-service.ts`
9. `src/server/services/enrollment-service.ts`
