# Optimum LMS Productization Audit

**Baseline:** 2026-10-01, current workspace state before productization implementation.
**Scope:** Frontend, Django API, ORM, authentication, dashboard/course/progress/video features, deployment/database configuration, accessibility signals, assets, dependencies, and tests.
**Change boundary:** This report is the first project artifact for this task. No application code or data was changed to produce it. The worktree already contains unrelated/in-progress edits; preserve them while implementing.

**Database decision update:** After this baseline was written, the requested target was clarified from PostgreSQL to Microsoft SQL Server (MSSQL). Current implementation changes therefore target MSSQL only; PostgreSQL recommendations below are superseded.

> The supplied request ends partway through Phase 10 at “Keyboard”. The audit covers the criteria visible in the prompt; a final accessibility sign-off must wait for the remainder of that checklist.

## Executive Summary

The repository has a functional single-tenant Django + React LMS foundation: account/role authorization, courses/modules/lessons/activities, enrollments, submissions, quizzes, progress locking, video-watch persistence, dashboard aggregates, and an isolated code runner are represented in server code and tests.

It is not yet a production-ready reusable template. The highest-impact mismatch is that the student dashboard silently substitutes realistic-looking demo content and metrics whenever APIs fail or return sparse data. Instructor and administrator dashboards do the same. Learning-path rendering is a fixed-width, SVG visualization fed by hardcoded student nodes rather than the existing course-progress API. This masks backend failures and can present invented learner records, grades, risk, deadlines, streaks, and cohort statistics as fact.

The database standard requested (PostgreSQL-only) is not present. Current configuration defaults to SQLite for development and requires SQL Server for production; Docker/docs/env examples also target SQL Server. Switching to PostgreSQL requires config/dependency/container/docs changes and a data migration plan. No PostgreSQL connection was available during this baseline audit.

## Architecture Inventory

- **Frontend:** Active Vite app is `frontend/` (`src/App.jsx`, `src/pages`, shared components/context/API utilities). `Dockerfile` builds only this app. The standalone Figma Make snapshot `elearning_extracted/` was removed on 2026-10-04 after confirming it had no application or build dependencies; `optimum-lms-react-kit/` remains a separate reference tree.
- **Backend:** Django apps currently include `accounts`, `courses`, `enrollment`, `progress`, `submissions`, `quizzes`, `execution`, `dashboards`, `risk`, `sequencing`, and `allocation`. Architecture docs omit the last three and contain stale implementation descriptions.
- **Authentication:** Custom email-login user and roles; JWT access/refresh; server-side role permissions and active-account checks; registration, email ownership verification, reset, throttling, and refresh-token revocation are implemented. `ProtectedRoute` is a UX boundary; API permissions remain the security boundary.
- **Course/API contracts:** Course, module, lesson, activity, attachments, enrollment, submissions/grading, quiz/question/attempt, course progress, video progress, dashboard, risk, sequencing, allocation, and execution routes exist. API docs are mostly detailed but backend README still claims quiz question authoring is missing, and architecture/deployment docs are out of sync.
- **Database:** Django migrations are provider-neutral; there are no SQLite-specific migration files. The SQLite dependency is configuration/docs/env, not model schema.

## Confirmed Findings

| Priority | Area | Evidence and current behavior | Productization gap |
|---|---|---|---|
| P0 | Student dashboard data integrity | `frontend/src/api/dashboardData.js` declares `MOCK_STUDENT_DASHBOARD` with named students, sample course/modules, grades, skill radar, weekly activity generated with `Math.random()`, deadlines, streaks, and cohort standing. It merges some API values into those defaults and returns the whole demo object on API failure. | A real user can see false records and false progress; API failure is hidden as success. Replace with API-shaped state and explicit empty/error states. |
| P0 | Instructor/admin data integrity | `InstructorDashboard.jsx` and `AdminDashboard.jsx` define rich hardcoded fallback records and use them when fetches fail. Risk fallback has invented students, factors, and recommendations. | Never present demo data as actual data; retain retry/error states and only show backend responses. |
| P0 | PostgreSQL-only standard | `config/settings.py` defaults `DB_ENGINE` to SQLite and allows MSSQL; production rejects anything except MSSQL. `requirements.txt`, `.env.example`, `.env.docker.example`, custom `config/mssql/`, Docker config, `DATABASE_SETUP.md`, deployment docs, and README reflect SQLite/MSSQL. | Replace all runtime/documented providers with PostgreSQL; add a driver and local/production config. Preserve data with an explicit export/import plan. Do not remove local DB files or credentials blindly. |
| P1 | Learning path source/scaling | Backend `GET /api/progress/course/{course_id}/` returns actual ordered module states; `/api/sequencing/me/` returns database-derived next-step recommendations. Student dashboard instead uses eight HTML/CSS/JavaScript/Git/React nodes from the mock fixture. `LearningPath.jsx` lays any node count onto fixed 880×160 coordinates. | Wire to enrolled course + module + lesson + progress APIs, remove subject-specific assumptions and fixed demo completion percentage. Make large paths scrollable/virtualizable or otherwise readable, and expose empty/loading/error/retry states. |
| P1 | Dashboard error/empty states | Student dashboard has a skeleton, but its fetch helper catches API errors and resolves to mock data, so no error/empty state is possible. Catalog uses live `/courses/` and `/enrollments/` with loading/error/empty states. Instructor/admin use fallback data. | Make fetch errors observable; render the specified “You have not enrolled in a learning path yet.” + Browse Courses state and retry/error handling. |
| P1 | Statistics and goals | `WEEK_DAYS`, weekly progress, KPI sparklines, radar, grade trends, deadline cards, recent results, “Full-Stack Track”, fixed completion percent and copy are fixture values. Backend student dashboard currently returns enrolled-course progress, pending submissions, and recent grades only. | Define measurable server-owned contract for goal/streak/achievements/deadlines and do not render unavailable metrics as real. |
| P1 | Notifications | `DashboardLayout.jsx` sets `notifications = []`; badge still pulses; “Mark all read” is a non-actionable span. No notification model/service/API route was found. | Either implement persisted notification API/permissions/read state or remove the false unread signal and leave a truthful disabled/empty state. |
| P1 | Achievements/certificates | No achievement or certificate model/endpoint was found. | Backend persistence, issue criteria, and APIs are needed before showing these features. |
| P1 | Video experience | `VideoProgress` persists current position, genuine watched intervals/time, completion and timestamps. API is role/enrollment/module guarded and throttled; backend completion threshold is 90%. Tracker sends 10-second heartbeats and avoids crediting seeks. YouTube and direct files are tracked; Vimeo embeds are not. | The player has invalid-link feedback, but no distinct loading/processing/missing/offline/API failure states; tracker swallows request failures as best-effort. Add recoverable UI and do not promise progress durability during outages. Duration is client-reported and does not unlock modules. |
| P1 | Analytics/risk quality | Performance snapshots and risk routes exist. `PerformanceSnapshot.snapshot_for_student_course()` estimates login/activity/time/attendance and related fields from assignment/quiz counts; risk package documentation says training labels are synthetic. | Label estimates and synthetic-trained output as non-authoritative; do not drive consequential decisions from it. Capture real telemetry and validate on real held-out outcomes before production use. |
| P2 | Icon system | Frontend uses `lucide-react`, but there is no central icon registry/type map or invalid-icon fallback/logging. UI includes emoji/status symbols in CodeLabModal, LearningPath, and StudentDashboard. | Create a safe Lucide registry matching the requested content types, default to BookOpen, log invalid names once, replace emoji UI symbols, and test missing/invalid values. |
| P2 | Accessibility/motion | Some controls use labels/status roles; dashboard CSS and hooks include `prefers-reduced-motion` support. LearningPath includes SVG animation and custom focus/clickable SVG groups; focus/keyboard coverage is not systematic. | Run WCAG contrast + keyboard/focus testing and make every path node operable/announced. Full requested checklist was truncated, so this is not a complete accessibility verdict. |
| P2 | Dead-code/asset candidates | Search found `frontend/src/api/modules.js` exports `getCourseModules()` with no callers. `frontend/public/dashboard-admin.png`, `dashboard-instructor.png`, and `dashboard-student.png` have no frontend source references. | Candidates only; verify historical/docs use and intended product use before deleting. Do not delete dashboard screenshots or duplicate reference trees blindly. |
| P2 | Duplicate/reference trees | Root contains `optimum-lms-react-kit/` and both `risk-engine/` and `backend/risk_engine/`. Active Vite/Docker frontend uses `frontend/`; backend risk imports `backend/risk_engine/`. | Mark supported sources of truth and establish a retention policy. Risk-engine duplication needs history/API comparison before removal. |
| P2 | Model/domain coverage | DB supports account, course tree, enrollment, activity completion, video progress, submissions, quiz/question/attempt, and weekly performance snapshot. Assignments are represented as generic `ActivityType.ASSIGNMENT` + `Submission`, not a separate assignment domain. Learning paths are course/module ordering plus computed recommendations, not a dedicated path entity. | Confirm this domain model is the intended template contract; implement missing achievement/notification/certificate domains only with defined lifecycle and authorization rules. |
| P2 | Scale/security operations | API has role checks, upload validation, rate limits, and sandbox isolation. Production docs recommend Redis/shared throttling, load tests, and HttpOnly cookie/BFF token storage before public launch. Admin dashboard returns all registered student PII in one response; instructor falling-behind calculation loops students. | Add pagination/minimization, operational telemetry, load testing, shared cache/throttling, and security review before multi-tenant/client deployments. |
| P3 | Docs/contracts | `backend/README.md` says no question-creation endpoint though `QuestionViewSet` exists. `docs/ARCHITECTURE.md` lists fewer apps, old token lifetimes and old topology. `DATABASE_SETUP.md` describes SQLite and MSSQL. | Regenerate/update docs after implementation from actual routes/config; keep one canonical contract. |

## Hardcoded Content Inventory

- Student demo identity `Alexandra Chen`, student ID/email, `Full-Stack Web Development`, module/lesson titles and counts, grades/sparklines, weekly activity, topic time, cohort leaderboard, deadlines, recent results, and sample lab code in `frontend/src/api/dashboardData.js`.
- Instructor fallback submissions, student/course names, falling-behind list, risk levels/factors/actions in `frontend/src/pages/InstructorDashboard.jsx`.
- Admin totals and five sample student records in `frontend/src/pages/AdminDashboard.jsx`.
- Student dashboard static weekdays, fixed copy/track labels, “Two modules done…” and `completedPct={37.5}` in `frontend/src/pages/StudentDashboard.jsx`.
- Landing marketing claim `12+ learning paths` in `frontend/src/Landing.jsx` is not backed by an API call.
- `backend/risk_engine`/risk-engine model metadata describes synthetic training data; snapshots also use explicit heuristic placeholders.

## Feature Support Matrix

| Feature | Database | API/service | Frontend | Audit status |
|---|---|---|---|---|
| Accounts, roles, auth | Yes | Yes | Yes | Implemented; production browser token-storage risk documented. |
| Courses/modules/lessons/activities | Yes | Yes | Catalog/content editor/course/lesson pages | Implemented; check contract validation and user flows during final QA. |
| Enrollments | Yes | Yes | Catalog enroll flow | Implemented. |
| Learning paths | Ordered Course/Module records | Progress + sequencing endpoints | Current path is demo fixture | Backend primitives exist; frontend path is not data-driven. |
| Progress locking | ActivityCompletion | Server-side service/endpoints | Course UI consumes status selectively | Implemented and tested. |
| Video playback | VideoProgress | Heartbeat/read/summary APIs | YouTube/Vimeo/file support | Position/watch completion supported for YouTube/files; missing resilient player states; Vimeo untracked. |
| Assignments/labs | Activity + Submission | Create/list/grade/download and validation | Submission/editor flows | Implemented as generic activities. |
| Quizzes | Quiz/Question/QuizAttempt | Authoring/read/submit | QuizTake | Implemented; docs stale about question authoring. |
| Analytics | PerformanceSnapshot + domain records | Dashboard/risk/allocation | Dashboard charts include many fixture values | Mixed real and fabricated/estimated. |
| Notifications | No model found | No route found | Bell is hardcoded empty with fake unread dot | Not implemented. |
| Achievements | No model found | No route found | No real data source found | Not implemented. |
| Certificates | No model found | No route found | No real data source found | Not implemented. |
| Sandbox execution | External isolated service | Django proxy + sandbox service | Code lab/editor | Present; needs production operations and browser-state QA. |

## Dependency and Test Baseline

- **Frontend runtime:** React 19, React Router, `lucide-react`, `react-helmet-async`; build/dev uses Vite 8 and Tailwind Vite plugin. No frontend test script/framework is configured; only `lint`, `build`, `dev`, and `preview` scripts exist.
- **Backend:** Django/DRF/SimpleJWT, `mssql-django`/`pyodbc`, plus substantial ML dependencies (`pandas`, `numpy`, scikit-learn, XGBoost, SHAP, joblib), Pillow, requests, dotenv, WhiteNoise, Gunicorn. PostgreSQL driver is absent.
- **Backend test baseline:** 158 tests passed with `DB_ENGINE=sqlite` and an isolated in-memory test DB. Existing warnings include intentionally mocked SMTP/sandbox failures and naïve datetimes in analytics tests.
- **Django baseline:** `manage.py check` clean; `makemigrations --check` reports no changes.
- **Frontend baseline:** `npm run lint` passes. The last production build on the current worktree passed before this audit.
- **PostgreSQL baseline:** not run; no PostgreSQL target/connection was available. A passing SQLite run is not evidence of PostgreSQL compatibility.

## Cleanup Candidates (Not Deleted)

- `frontend/src/api/modules.js` (export has no callers in current `frontend/src`).
- Three `frontend/public/dashboard-*.png` screenshots with no source references in the active app.
- `optimum-lms-react-kit/` and duplicate-looking root/backend risk-engine trees; preserve until canonical-source/history comparison is complete.
- Existing local database/media and user test data: inventory and back up before any destructive cleanup or provider migration. No database/file data was deleted during this audit.

## Implementation Order and Release Gates

1. Replace dashboard fallbacks with real API contracts and explicit loading/empty/error/retry states; add regression tests that fail if demo data is shown.
2. Build the learning path from selected enrollment, course modules, lessons, and progress; make node rendering responsive/scalable and status/motion accessible.
3. Remove fabricated stats/deadlines/leaderboards, then define and implement real goal/streak/achievement/notification/certificate contracts rather than leaving implied demo controls.
4. Add/finish video loading, processing, missing, offline, API-error, and retry states; test resume/seek/completion behavior end-to-end.
5. Introduce centralized Lucide registry, remove emoji UI, audit keyboard/focus/contrast/reduced motion.
6. Keep database/runtime/docker/env/docs MSSQL-only. Before removing or migrating any legacy database, verify its contents, backup/export/import and rollback plan; validate connection, migrations, and the full suite on the target SQL Server.
7. Update architecture/API/deployment docs, identify safe deletion candidates, and produce dependency/deleted-file reports after verified cleanup.
8. Gate release on backend + frontend tests, actual MSSQL migrations, browser E2E, accessibility checks, and load/security review. Confirm whether future clients mean isolated per-client deployments or shared multi-tenancy before adding tenant isolation.

**Deleted files in this audit:** none. This is intentional; candidate deletion needs the implementation phase and verification.
