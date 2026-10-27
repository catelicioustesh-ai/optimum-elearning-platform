# Course Creation and Publishing Audit

## Baseline report (before fixes)

**Audit date:** 2026-10-19  
**Scope:** Instructor course creation, editing, curriculum/content, draft and publish actions, course visibility, permissions, and their direct API dependencies.

### Executive summary

The repository contains an implemented course-authoring flow rather than a missing Publish control. The instructor workspace creates drafts, preserves the returned course ID, loads the selected course and its content, saves course details, and calls the backend publish action. The backend validates minimum curriculum completeness and filters drafts out of the student catalog. Ownership and role checks are applied server-side.

The reported user-facing failure could not be reproduced from repository evidence: no running application, instructor session, failed request trace, or actual failing API response was available. Existing course API tests pass against an isolated SQLite test database. Therefore the primary runtime cause remains **unconfirmed**; it would be incorrect to claim a frontend or backend publishing defect based only on the reported symptom.

One confirmed API-contract defect exists: `docs/API_REFERENCE.md` says a new course may be created directly as `published`, but the actual API rejects that request and requires the draft/publish lifecycle. The instructor UI already sends `status: "draft"`, so this discrepancy does not explain a failure in that UI. The reference will be corrected.

### Architecture and relevant code paths

- **Frontend:** React 19 with Vite and React Router. The protected route `/dashboard/instructor/content` renders `InstructorContent`. Shared requests, JSON/multipart handling, CSRF cookies, JWT refresh, and error conversion are in `frontend/src/lib/api.js`.
- **Backend:** Django 6.1 and Django REST Framework. `backend/config/urls.py` mounts the `apps.courses` router under `/api/`; DRF viewsets implement course, module, lesson, activity, attachment, and live-session APIs.
- **Persistence:** `Course`, `Module`, `Lesson`, `Activity`, and `LessonAttachment` are related Django models. The authoritative publication state is `Course.status` (`draft` or `published`); `CourseViewSet.perform_create` forces new API courses to draft and the `publish` action changes status only after completeness checks.
- **Authorization:** `ReadOnlyOrInstructorAdmin` allows authenticated reads and instructor/admin writes. `require_teaches` and course-scoped querysets enforce ownership; admin management is intentionally broader. Student course queries only include published courses. Student lesson/attachment visibility additionally uses enrollment and module-unlock rules.
- **Uploads:** course thumbnails, lesson videos, and PDFs use Django file fields under `backend/media`; videos and PDFs are delivered by protected API endpoints. The frontend uses `FormData` via `api.upload` without manually setting the multipart boundary.
- **Configuration:** `backend/config/settings.py` reads database, CORS/CSRF, OAuth, and storage-related settings from environment configuration. The configured database engine is Microsoft SQL Server. No credential values are included here.
- **Tests:** Django API tests are under the individual `backend/apps/*/tests*.py` modules. Frontend package scripts provide Vite build and ESLint; no frontend test script is declared.

### End-to-end workflow traced

1. An authenticated instructor opens `/dashboard/instructor/content`.
2. The page loads `GET /api/courses/?manage=true`; the backend returns only courses owned by that instructor. Admins receive all managed courses.
3. Creating a course calls `POST /api/courses/` as JSON or multipart (optional thumbnail), with `status: "draft"`. The backend assigns the authenticated user as instructor and returns the new ID and draft state.
4. Selecting the course loads its detail, modules, and live sessions. Module and lesson forms persist content through their own APIs; media uses multipart uploads. Activity/quiz creation has separate endpoints.
5. Saving details uses `PATCH /api/courses/{id}/` or multipart `PUT` when replacing the cover. The UI saves details before calling the lifecycle action.
6. “Save as draft” calls `POST /api/courses/{id}/save_draft/`. “Publish course” calls `POST /api/courses/{id}/publish/`. The server requires at least one module, a lesson in every module, and at least one question for every quiz activity.
7. After success, the frontend updates the course status from the API response. Student-facing `GET /api/courses/` and course detail queries exclude drafts and include a published course.

**Reproduction steps for the reported failure:** the source-supported path is the sequence above, using an instructor account and a course that meets the server prerequisites. The backend test suite successfully exercised draft creation, failed early publication, curriculum completion, publication, and student detail visibility. The actual reported failure has no supplied URL, account/role, request payload, response, or browser/server log, and could not be reproduced against a running deployment in this audit.

### Baseline API inventory

“Not live-tested” means no running API/deployment request was available. Test observations below are from Django API tests using a temporary SQLite database, not from the configured SQL Server deployment.

| Endpoint | Purpose / caller | Expected behavior | Observed result | Root cause / severity | Fix and verification |
|---|---|---|---|---|---|
| `GET /api/courses/?manage=true` | Load instructor workspace course list (`InstructorContent`) | Instructor sees owned courses; admin sees all managed courses | `200`; scope assertions pass | No failure confirmed; low | No runtime fix indicated; course API suite |
| `POST /api/courses/` | Create draft (`handleAddCourse`) | Accept JSON or multipart; associate authenticated instructor; return created ID and `draft` | `201`; response draft checked | No failure confirmed; low | No runtime fix indicated; course API suite |
| `GET /api/courses/{id}/` | Load course editor / student detail | Owner can read draft; student sees published course only | Draft student read `404`; after publish `200` | No failure confirmed; low | No runtime fix indicated; course API suite |
| `PATCH` / `PUT /api/courses/{id}/` | Save course details / replace thumbnail (`saveCourseDetails`) | Persist submitted fields and preserve omitted fields; multipart for image | Multipart cover replacement `200`; persisted URL appears in catalog | No failure confirmed; low | No runtime fix indicated; course API suite |
| `POST /api/courses/{id}/save_draft/` | Return a course to draft (`setCourseStatus`) | Owning instructor/admin only; hide from students | Not separately exercised by focused course tests; not live-tested | No observed failure; medium evidence gap | Verify via authenticated integration test/deployed API |
| `POST /api/courses/{id}/publish/` | Publish course (`setCourseStatus`) | Validate course content, persist `published`, return status | Incomplete course `400`; complete course `200`; student detail `200` | No failure confirmed in isolated tests; live deployment untested | No code fix indicated; course API suite |
| `GET` / `POST /api/modules/`; `POST /api/modules/reorder/` | Create/list/reorder course sections | Scope to course; enforce owner; preserve exact order | Module create and reorder paths used; reorder assertions pass | No failure confirmed; low | No runtime fix indicated; course API suite |
| `GET` / `POST` / `PATCH` / `DELETE /api/lessons/`; `POST /api/modules/{id}/reorder-lessons/` | Create, load, update, delete, reorder lessons | Associate lessons with a module; validate video input; enforce ownership | Link and uploaded-video creation pass; order assertions pass; other mutations not live-tested | No failure confirmed; low | No runtime fix indicated; course API suite |
| `GET` / `POST` / `PATCH` / `DELETE /api/activities/` | Manage assignments/labs/exercises (`InstructorContent`) | Enforce instructor ownership and activity validation | Activity update is exercised; activity creation/deletion not live-tested here | No specific failure confirmed; medium evidence gap | Broader endpoint tests / deployed API verification |
| `POST /api/quizzes/build/` | Create quiz/activity/questions (`handleCreateQuiz`) | Persist quiz and questions together; publish rejects questionless quizzes | Frontend caller and route are present; not exercised in the focused course suite | No observed failure; medium evidence gap | Verify via quiz test suite and deployed API |
| `GET` / `POST` / `DELETE /api/lesson-attachments/`; `GET /api/lesson-attachments/{id}/download/` | Upload/list/delete/download lesson PDFs | Multipart upload; validate PDF; protected download | Existing account permission tests cover attachment behavior; no live request | No failure established; low | Re-run permission tests and live upload if configured |
| `GET` / `POST` / `DELETE /api/live-sessions/` | Manage optional instructor-led sessions | Instructor/admin ownership; future date and secure URL validation | Create/list and rejection/ownership tests are present | No failure confirmed; low | No workflow fix indicated |
| `GET /api/enrollments/`; `POST /api/enrollments/` | Student catalog enrollment (`CourseCatalog`) | Students enroll only in available published courses | Course visibility is verified; full catalog browser flow not live-tested | No failure confirmed; low | Verify through end-to-end environment |

### Baseline findings

#### Confirmed

1. **API reference conflicts with backend create contract.** The Courses section in `docs/API_REFERENCE.md` states `status` may be `draft` or `published` on `POST /api/courses/`. The backend explicitly rejects any new status other than `draft` with HTTP 400; the existing course test confirms the rejection. A client following the reference can therefore receive a validation error. **Severity: Low (documentation/API-client contract).**
2. **A deployment-level publish failure is not evidenced.** The focused backend tests pass on isolated SQLite. The configured SQL Server test-database creation cannot run here because the current database principal cannot create a test database in `master`. This is a test-environment limitation, not evidence that the application publish endpoint is failing.

#### Unconfirmed / requiring runtime evidence

- No failed frontend request, backend exception, SQL Server migration failure, storage write failure, CORS/CSRF rejection, or authorization denial was captured.
- The issue may depend on deployment-only configuration, existing database state, or a specific course payload; these remain hypotheses, not findings.
- Browser console/network behavior and deployed catalog visibility could not be checked without a running app and instructor credentials.

### Security, database, and storage baseline

- New API courses are tied to `request.user`; an instructor-supplied `instructor` value is read-only.
- Role checks and object ownership are enforced on write paths; student writes are rejected and instructor querysets are owner-scoped. Do not bypass these controls to resolve a publish error.
- `Course.status` is the lifecycle source of truth. Student course lists filter to `published`; course publication is not inferred from frontend state.
- Database migrations for the course app are present through `0010`; migrations applied successfully to the temporary SQLite test database. SQL Server-specific migration compatibility and deployment schema state remain unverified.
- Thumbnail, lesson video, and lesson attachment binaries are stored through Django storage configuration; only protected API URLs are intended for lesson videos/PDFs. No deployed storage endpoint was available to probe.

### Severity-ranked remediation plan

1. **Low — correct the API reference** to state that course creation starts in draft and publication occurs through the publish action. Add or update contract-level coverage only if necessary.
2. **Medium — obtain a concrete failing browser/network trace or test against the target deployment** (request route/method, response body/status, authenticated role, and server log correlation) before changing runtime logic.
3. **Medium — verify the SQL Server migrations, uploads, course editor, publish action, and student catalog in the deployment’s isolated staging/test environment** once appropriate test database permissions and an instructor account are available.

### Files identified for follow-up

- `docs/API_REFERENCE.md` — stale course-create status contract.
- `frontend/src/pages/InstructorContent.jsx` and `frontend/src/lib/api.js` — authoring UI and request contract; no implementation bug confirmed by inspection.
- `backend/apps/courses/views.py`, `serializers.py`, `models.py`, `urls.py`, and `tests.py` — publishing rules, schema, persistence, routes, and regression coverage; no implementation bug confirmed by focused tests.
- `backend/apps/accounts/access.py` and `permissions.py` — shared role and ownership enforcement.
- `frontend/src/pages/CourseCatalog.jsx` and `CourseView.jsx` — student-facing course discovery and detail.

### Baseline verification evidence

| Check | Result |
|---|---|
| `backend/apps/courses` Django tests | **PASS** — 12 tests, temporary isolated SQLite database; course migrations applied cleanly. |
| Frontend production build (`npm run build`) | **PASS** — Vite build completed. |
| Frontend lint (`npm run lint`) | **PASS** — ESLint completed. |
| Configured SQL Server test database | **BLOCKED** — SQL Server denied `CREATE DATABASE` in `master`; no production data was used or modified. |
| Live HTTP/browser workflow | **NOT RUN** — no shared running application/session or instructor credentials were available. |
| Instructor permission regression tests | **IN PROGRESS** at report creation; final result will be added after completion. |

### Acceptance criteria and current status

The current source demonstrates the intended API-level draft-to-publish lifecycle in automated tests, but the user’s reported failure has not been tied to a specific request or reproduced in the target environment. Accordingly, the audit is not claiming a verified user-facing fix. The documentation contract defect is the only confirmed issue currently queued for correction.

**Baseline acceptance status: NOT VERIFIED** — the live critical workflow has not been demonstrated against the configured deployment.
