# Coding E-Learning Platform — Django Backend

Django + Django REST Framework, organized into domain apps: `accounts`,
`courses`, `enrollment`, `progress`, `submissions`, `quizzes`, `execution`,
`dashboards`, `engagement`, `risk`, `sequencing`, and `allocation`.

## Setup

From the repository root, install Python and Microsoft ODBC Driver 18 for
SQL Server, then configure SQL Server and `backend/.env` as described in the
root [DATABASE_SETUP.md](../DATABASE_SETUP.md). The backend requires SQL Server;
SQLite is not a supported runtime database.

### Windows (PowerShell)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env with this developer's own SQL Server connection values.
python manage.py check
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

### macOS / Linux (bash)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with this developer's own SQL Server connection values.
python manage.py check
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

API is at `http://localhost:8000/api/`. Django admin (for creating
instructor/admin accounts — see security note below) is at
`http://localhost:8000/admin/`.

## Database

Microsoft SQL Server is the only supported database. Install ODBC Driver 18 and configure `MSSQL_DB_NAME`, `MSSQL_DB_USER`, `MSSQL_DB_PASSWORD`, `MSSQL_DB_HOST`, and `MSSQL_DB_PORT`, then run `python manage.py migrate`. See the root [DATABASE_SETUP.md](../DATABASE_SETUP.md) for certificate, Docker, and existing-data migration guidance.

## What's implemented and verified

Every endpoint below was tested against a running server, not just written:

- **Auth**: register (student-only, see security note), login (JWT, role
  embedded in token), token refresh, `/me/`
- **Courses**: full CRUD for Course → Module → Lesson → Activity,
  instructor-only writes, verified a student gets 403 trying to write
- **Enrollment**: students self-enroll and may unenroll from their own courses;
  unenrolling preserves submissions, grades, quiz attempts, and progress
- **Progress / module locking**: verified live — Module 2 was `locked`
  before Module 1's activity was graded, `active` after, and `done` once
  its own required activity (a quiz) was passed. This is the brief's
  section 4 requirement, enforced server-side.
- **Submissions**: attempt limiting verified (2nd submission on a
  `max_attempts=1` activity correctly rejected with 400); grading
  triggers module-completion
- **Quizzes**: instructor/admin question authoring and auto-grading are
  implemented — wrong answers do not unlock the next module; passing answers
  do
- **Dashboards**: all three (student/instructor/admin) return real
  aggregated data from a real multi-step scenario, and cross-role access
  is blocked (student → admin dashboard = 403)

## Operational follow-up

- **`execution` app**: forwards to the separate `sandbox/` service in this
  repository. Keep the runner isolated from Django and verify its container
  restrictions and network boundaries in the deployment environment.
- **"Falling behind" definition** in the instructor dashboard (no
  completed activity in 7 days) is a real, working first pass — loops over
  every enrolled student per course. Fine at small scale; revisit with a
  cached/precomputed version before 3,000 students make that loop slow.
- Submission uploads have server-side extension, signature/content, size,
  and archive validation in `apps/submissions/validators.py`.
- Production requires real `DJANGO_SECRET_KEY`, host, and CORS values; startup fails closed when they are missing.
- Production requires SQL Server connection values and HTTPS email-link configuration.
- Refresh tokens rotate and are blacklisted after use; clients should call `/api/auth/logout/` before clearing a session.
- Public signup creates students only. Administrators can create instructor and admin accounts at `/admin/`, where the platform role is explicitly selectable.
- The first account created with `createsuperuser` is automatically assigned the `admin` platform role.

## Important security fix made during testing

The original `RegisterSerializer` accepted a `role` field in the request
body — meaning anyone could `POST /api/auth/register/` with
`"role": "admin"` and get an admin account. **This was caught and fixed**:
public registration now always creates a `student` account regardless of
what's sent. Instructor and admin accounts must be created through
`/admin/` by someone who already has admin access. If you ever add a
"create instructor" flow to the product later, make sure it's gated behind
an existing admin's session — don't reopen this field on the public
endpoint.

## Role-based permission pattern

Every app reuses the same permission classes from `apps/accounts/permissions.py`:

```python
from apps.accounts.permissions import ReadOnlyOrInstructorAdmin, IsInstructorOrAdmin, IsAdmin

class SomeViewSet(viewsets.ModelViewSet):
    permission_classes = [ReadOnlyOrInstructorAdmin]  # anyone reads, only instructor/admin writes
```

## Notes

- `AUTH_USER_MODEL` is a custom `User` (email login, `role` field) — this
  was set before the first migration, which is required in Django;
  swapping user models later means rebuilding migrations from scratch.
- Progress/locking logic lives in `apps/progress/services.py` as plain
  functions (`is_module_unlocked`, `is_module_complete`,
  `mark_activity_complete`), not buried inside a view — `submissions` and
  `quizzes` import and call `mark_activity_complete` directly when work
  passes, rather than each app re-implementing completion logic.
