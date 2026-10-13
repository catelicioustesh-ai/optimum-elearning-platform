# Frontend Team Handoff — Optimum ERP LMS

This document gives a frontend team the connection details and complete route
map for the Django REST API. Use [API_REFERENCE.md](./API_REFERENCE.md) for
request/response examples, field definitions, validation rules, and the
server-side access-control details. That reference is the contract for payload
shapes; update it whenever a serializer or endpoint changes.

## Connect to the backend

- Local API root: `http://localhost:8000/api`
- Configure the frontend with `VITE_API_URL=http://localhost:8000/api`.
  The value is the API root without a trailing slash. The existing React client
  defaults to this URL in [api.js](../frontend/src/lib/api.js).
- If each developer runs the backend and frontend on their own PC, keep
  `localhost`: the browser and backend are on the same computer. Each developer
  needs their own backend `.env` and local SQL Server configuration. If the
  backend is instead running on another PC, replace `localhost` with that
  machine's reachable host/IP and configure Django's allowed hosts, CORS, and
  firewall accordingly.
- Production must use the HTTPS API URL. The backend must allow the deployed
  frontend origin in `CORS_ALLOWED_ORIGINS`.
- Requests and responses use JSON unless a route below says otherwise.
  Authenticated calls send `Authorization: Bearer <access-token>`.
- For uploads, send `FormData` / `multipart/form-data` and let the browser set
  the multipart boundary. For downloads, treat the response as a blob; lesson
  attachments and student submissions are not public `/media/` URLs.
- Collection endpoints currently return JSON arrays, not paginated DRF
  envelopes.

For interactive API documentation during local development, open `/api/docs/`
for Swagger UI or `/api/redoc/` for ReDoc; `/api/schema/` serves the OpenAPI
schema. These routes are available only when Django runs with `DEBUG=True`.
The route inventory below and [API_REFERENCE.md](./API_REFERENCE.md) remain
the source for usage guidance and behavior details that are not expressed by
the generated schema.

## Run the backend and frontend locally (Windows)

The team can run a separate local backend per developer; a shared backend
server is not required when everyone has a local SQL Server. Before starting,
install Python, Node.js/npm, Microsoft SQL Server, and Microsoft ODBC Driver 18
for SQL Server. Follow [DATABASE_SETUP.md](../DATABASE_SETUP.md) to create the
database/login and configure the database connection. SQL Server is required;
the backend does not use SQLite as a supported runtime database.

From the repository root, use PowerShell:

```powershell
# Backend terminal
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Edit backend\.env with that developer's own SQL Server name/database/login/password.
python manage.py check
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

In a second terminal:

```powershell
# Frontend terminal, from the repository root
cd frontend
npm install
Copy-Item .env.example .env.local
# Keep VITE_API_URL=http://localhost:8000/api for the local backend.
npm run dev
```

Open the Vite address printed by the frontend command (normally
`http://localhost:5173`). Django's API is at `http://localhost:8000/api/` and
its admin is at `http://localhost:8000/admin/`. Development email is printed
in the backend terminal. The `createsuperuser` account has the platform admin
role; use Django admin to create instructor accounts. Public registration
creates student accounts only.

If the frontend changes API payload handling or shared API-client code, rerun
the local checks from `frontend/`:

```powershell
npm run lint
npm run build
```

After backend changes, run from `backend/`:

```powershell
python manage.py check
python manage.py test
```

Check the browser's Developer Tools **Network** tab for failed request URLs,
status codes, and response bodies, and check the Django terminal for matching
server errors. After a fix, rerun the failing UI flow and the relevant checks.
Never copy or share a developer's real `.env`; each person should use their
own local secrets and database credentials.

## Authentication and roles

1. Register with `POST /auth/register/` or sign in with
   `POST /auth/login/` using email and password.
2. Keep both returned JWTs. Send the access token as a Bearer token.
3. Access tokens last 15 minutes; refresh tokens last 7 days. Call
   `POST /auth/login/refresh/` with `{ "refresh": "..." }` when the access
   token expires. Refresh tokens rotate: persist both tokens from the response
   and serialize concurrent refresh attempts so the same refresh token is not
   submitted twice.
4. On sign-out, call `POST /auth/logout/` with the refresh token, then clear
   client session state. `GET /auth/me/` returns the current user.

Roles are `student`, `instructor`, and `admin`. Public registration always
creates a student; instructor/admin accounts are provisioned through Django
admin. Token role claims are useful for user-interface routing only.
Backend permissions are authoritative; expect `401`, `403`, or `404` even if
the UI has already hidden a control.

## API route inventory

Paths are relative to `/api`. `{id}` is a numeric resource ID unless noted.
`🔒` means a valid access token is required. Instructor writes are restricted
to courses that instructor owns.

### Authentication — `/auth/`

| Method | Path | Access |
|---|---|---|
| POST | `/auth/register/` | Public; creates a student |
| POST | `/auth/login/` | Public |
| POST | `/auth/login/refresh/` | Public; refresh token |
| POST | `/auth/logout/` | 🔒 |
| GET | `/auth/me/` | 🔒 |
| POST | `/auth/email/verify/` | Public |
| POST | `/auth/email/resend-verification/` | Public |
| POST | `/auth/password-reset/` | Public |
| POST | `/auth/password-reset/confirm/` | Public |

### Courses and learning content

| Methods | Path | Access / notes |
|---|---|---|
| GET, POST | `/courses/` | 🔒; POST instructor/admin |
| GET, PUT, PATCH, DELETE | `/courses/{id}/` | 🔒; writes owning instructor/admin |
| POST | `/courses/{id}/save_draft/` | 🔒; owning instructor/admin |
| POST | `/courses/{id}/publish/` | 🔒; owning instructor/admin |
| GET, POST | `/modules/` | 🔒; POST instructor/admin |
| GET, PUT, PATCH, DELETE | `/modules/{id}/` | 🔒; writes owning instructor/admin |
| POST | `/modules/reorder/` | 🔒; owning instructor/admin |
| POST | `/modules/{id}/reorder-lessons/` | 🔒; owning instructor/admin |
| GET, POST | `/lessons/` | 🔒; POST instructor/admin |
| GET, PUT, PATCH, DELETE | `/lessons/{id}/` | 🔒; writes owning instructor/admin |
| GET | `/lessons/{id}/video/` | 🔒; authenticated video stream; supports byte ranges |
| GET, POST | `/activities/` | 🔒; POST instructor/admin |
| GET, PUT, PATCH, DELETE | `/activities/{id}/` | 🔒; writes owning instructor/admin |
| GET, POST | `/lesson-attachments/` | 🔒; PDF attachments; POST instructor/admin |
| GET, PUT, PATCH, DELETE | `/lesson-attachments/{id}/` | 🔒; writes owning instructor/admin |
| GET | `/lesson-attachments/{id}/download/` | 🔒; authenticated file download |
| GET, POST | `/enrollments/` | 🔒; POST student self-enrollment |
| GET, DELETE | `/enrollments/{id}/` | 🔒; DELETE only the student's own enrollment |

Unenrolling revokes course access but preserves the student's submissions,
grades, quiz attempts, and progress records.

Student lesson/activity reads are filtered by enrollment and module unlocking.
Locked content is deliberately not made available by calling a detail URL
directly. Student module lists may still show locked module titles and order.

### Progress, submissions, quizzes, and code execution

| Method | Path | Access / notes |
|---|---|---|
| GET | `/progress/course/{course_id}/` | 🔒; module statuses |
| GET | `/progress/can-access/{module_id}/` | 🔒; module access check |
| GET, PUT | `/progress/video/{lesson_id}/` | 🔒; student video progress |
| GET | `/progress/video/{lesson_id}/summary/` | 🔒; teaching instructor/admin |
| GET, POST | `/submissions/` | 🔒; POST student |
| GET | `/submissions/{id}/` | 🔒; scoped read |
| GET | `/submissions/{id}/download/` | 🔒; authenticated file download |
| PATCH | `/submissions/{id}/grade/` | 🔒; instructor/admin |
| GET, POST | `/quizzes/` | 🔒; POST instructor/admin |
| GET, PUT, PATCH, DELETE | `/quizzes/{id}/` | 🔒; writes owning instructor/admin |
| POST | `/quizzes/build/` | 🔒; owning instructor/admin; creates a quiz and questions |
| POST | `/quizzes/{quiz_id}/submit/` | 🔒; student; auto-graded |
| GET, POST | `/quiz-questions/` | 🔒; instructor/admin only |
| GET, PUT, PATCH, DELETE | `/quiz-questions/{id}/` | 🔒; owning instructor/admin |
| GET | `/quiz-attempts/` and `/quiz-attempts/{id}/` | 🔒; read-only, role-scoped |
| POST | `/execute/run/` | 🔒; authenticated; uses isolated runner |
| POST | `/execute/test/` | 🔒; enrolled student with unlocked module, teaching instructor, or admin |

Submissions and quiz attempts cannot be edited or deleted. Correct quiz answers
are excluded from student quiz reads. Code execution is separately dependent
on the sandbox service and can return `503` when that service is unavailable.

### Dashboards, engagement, and recommendations

| Method | Path | Access / notes |
|---|---|---|
| GET | `/dashboard/student/` | 🔒 |
| GET | `/dashboard/instructor/` | 🔒; instructor/admin |
| GET | `/dashboard/admin/` | 🔒; admin |
| GET | `/engagement/me/` | 🔒; student |
| GET | `/engagement/notifications/` | 🔒; caller's notifications |
| PATCH | `/engagement/notifications/{id}/read/` | 🔒; recipient |
| POST | `/engagement/notifications/read-all/` | 🔒 |
| GET | `/engagement/certificates/?course_id={id}` | 🔒; owning instructor/admin |
| POST | `/engagement/certificates/issue/` | 🔒; owning instructor/admin |
| GET | `/engagement/certificates/{certificate_number}/` | 🔒; certificate participant or admin |
| GET | `/engagement/certificates/{certificate_number}/download/` | 🔒; PDF download |
| GET | `/engagement/certificates/{certificate_number}/verify/` | Public; certificate verification |
| POST | `/engagement/certificates/{certificate_number}/revoke/` | 🔒; owning instructor/admin |
| GET | `/sequencing/me/` | 🔒; personalized recommendations for the signed-in user |
| GET | `/risk/cohort/` | 🔒; instructor/admin; model-dependent risk cards |
| GET | `/risk/student/{student_id}/course/{course_id}/` | 🔒; instructor/admin |
| GET | `/allocation/recommendations/` | 🔒; admin; read-only workload recommendations |

`certificate_number` is a UUID. The individual risk route may return `204`
with no body when the student does not have enough history. The cohort risk
route may return skipped students in `skipped_insufficient_history`.

## Errors and UI behavior

- `400`: invalid input or a business rule such as an exhausted attempt limit.
  Show field-level errors where provided.
- `401`: missing/expired credentials; attempt refresh, then return to sign-in
  if refresh fails.
- `403`: authenticated user lacks the role or action permission.
- `404`: missing or intentionally hidden resource; do not assume the ID exists.
- `429`: throttled request; show a retry message.
- `204`: successful empty result for the individual risk score route; no JSON
  body should be parsed.
- `503`: an optional dependent service (risk model or code runner) is
  temporarily unavailable.

## Frontend/backend boundary notes

- Existing API wrappers are in [frontend/src/api/](../frontend/src/api/) and share
  [api.js](../frontend/src/lib/api.js). New UI work should use that client (or preserve
  its equivalent auth refresh, errors, downloads, and upload behavior).
- [messages.js](../frontend/src/api/messages.js) currently posts to `/messages/`, but no
  `/api/messages/` route is registered by this backend. Treat that feature as
  unsupported until the backend team adds and documents an endpoint.
- Keep the backend as the source of truth for module locking, grades,
  attempt counts, certificate state, and role permissions. Do not implement
  these as client-only restrictions.
- Before handoff sign-off, test at least one student, instructor, and admin
  session against their role-specific dashboard and content paths, plus an
  expired access token and a multipart upload.
