# API Reference — Optimum ERP LMS

Base URL: `http://localhost:8000/api` (local) — swap for your real domain
in production, always over HTTPS.

Every field name below is taken directly from the serializers in the
codebase, not written from memory — if something changes in the code,
update it here too.

## Interactive API documentation

When running Django with `DEBUG=True`, open `/api/docs/` for Swagger UI,
`/api/redoc/` for ReDoc, or fetch the OpenAPI schema at `/api/schema/`.
These documentation routes are disabled when `DEBUG=False`; the normal API
routes and authentication behavior are unchanged.

The schema is generated from DRF serializers and explicit view metadata.
Run `python manage.py spectacular --validate` after API changes to check it;
the hand-maintained reference remains the source for usage guidance and
behavioral details that are not expressed by an OpenAPI schema.

## Conventions used throughout this doc

- 🔒 = requires `Authorization: Bearer <access_token>` header
- Role column shows who can call it: **Any** (any logged-in user),
  **Student**, **Instructor**, **Admin**, or a combination
- Request/response bodies are JSON unless noted
- List endpoints currently return plain JSON arrays; pagination is not configured.

---

## Authentication

JWT-based. **Access tokens last 15 minutes, refresh tokens last 7 days**
(`config/settings.py` → `SIMPLE_JWT`). Refresh tokens **rotate**: each call to
`/auth/login/refresh/` returns a new refresh token and blacklists the old one, so
concurrent refreshes must be serialised (the frontend does this — see `refreshAccessToken()`
in `frontend/src/lib/api.js`). The access token's payload embeds `role` and `email` for
UI routing only; **the server always re-reads the role from the database**, so a stale
token can never grant access.

### One-time email links

| Link | Lifetime | Single use? | Setting |
|---|---|---|---|
| Email verification | 24 hours | yes | `EMAIL_VERIFICATION_TIMEOUT` |
| Password reset | 1 hour | yes | `PASSWORD_RESET_TIMEOUT` |

Both are signed tokens bound to the account's current state, so they stop working as soon
as they are used (verification) or the password changes (reset). Expired, reused, tampered,
or wrong-user links all return the same `400` — they are never distinguishable.

### Password rules
At least 8 characters, an uppercase letter, a lowercase letter and a number; not too common,
not all digits, not similar to the username/email, and **no leading/trailing space**.
(Login ignores stray leading/trailing spaces, which is why they can't be part of a password.)
These apply when a password is *set* (register, reset) — existing passwords are unaffected.

### Email and username matching
Login, registration, resend and reset treat email **case-insensitively** and ignore
surrounding whitespace. Usernames are unique regardless of case. **Passwords are case-sensitive.**

### `POST /api/auth/register/`
Public. Rate-limited to 10 requests/minute per IP.

**Always creates a `student` account** — `role` is not an accepted field
here, regardless of what's sent in the body. This is deliberate (see
`backend/README.md` for why). Instructor/admin accounts are created via
Django admin.

Request:
```json
{
  "username": "bkimani",
  "email": "bkimani@example.com",
  "password": "at-least-8-characters",
  "first_name": "Brian",
  "last_name": "Kimani"
}
```

Response `201`:
```json
{ "id": 4, "username": "bkimani", "email": "bkimani@example.com", "first_name": "Brian", "last_name": "Kimani" }
```

### `POST /api/auth/login/`
Public. Rate-limited to 10 requests/minute per IP. Logs in with **email**,
not username.

Request:
```json
{ "email": "bkimani@example.com", "password": "..." }
```

Response `200`:
```json
{ "access": "<jwt>", "refresh": "<jwt>" }
```
Decode the `access` token client-side to read `role` and `email` — see
`frontend/src/lib/api.js` → `decodeToken()`.

Errors (`401`):
- Wrong email or password → `{"detail": "Incorrect email or password."}` (identical for unknown emails).
- Unverified email addresses may still authenticate when the credentials are correct and the account is active. Email verification confirms mailbox ownership but is not a login requirement.
- `429` after too many attempts (10/minute per client IP; see `NUM_PROXIES` in the deployment notes).

### `POST /api/auth/email/verify/` — Public
`{ "uid": "<from link>", "token": "<from link>" }` → `200 {"detail": "..."}`; `400` if the link is
invalid, expired (24 h) or already used.

### `POST /api/auth/email/resend-verification/` — Public (5/hour)
`{ "email": "..." }` → always `200` with the same message whether or not the account exists.

### `POST /api/auth/password-reset/` — Public (5/hour)
`{ "email": "..." }` → always `200`, same message for unknown, unverified and inactive accounts.
Active accounts with a usable password, whether email-verified or not, are emailed a link to `{FRONTEND_URL}/reset-password?uid=…&token=…`.

### `POST /api/auth/password-reset/confirm/` — Public
```json
{ "uid": "...", "token": "...", "new_password": "...", "confirm_password": "..." }
```
`200` on success: the password changes, **all of the user's refresh tokens are blacklisted**
(signed out everywhere) and a "your password was changed" email is sent. `400` for an
invalid/expired/used link or a password that breaks the rules above (a rejected password
does **not** consume the link).

### `POST /api/auth/login/refresh/`
Public. Exchange a refresh token for a new access token.

Request: `{ "refresh": "<refresh_token>" }`
With refresh rotation enabled, response: `{ "access": "<new_access_token>", "refresh": "<new_refresh_token>" }`.
Persist both returned tokens; the submitted refresh token is blacklisted.

### `POST /api/auth/logout/` 🔒 — Any
Revokes the submitted refresh token. Send `{ "refresh": "<refresh_token>" }`
with the access-token bearer header, then clear the local session. A successful
logout returns an empty response.

### `GET /api/auth/me/` 🔒 — Any
Returns the logged-in user.

Response:
```json
{ "id": 4, "username": "bkimani", "email": "...", "first_name": "Brian", "last_name": "Kimani", "role": "student" }
```

---

## Courses

Read access: any authenticated user. Write access: instructor/admin only
(`ReadOnlyOrInstructorAdmin` permission — same pattern reused across every
app below marked "Instructor/Admin write").

Course visibility is status-aware: students see published courses only;
instructors see their own courses plus published catalog courses; admins see
all courses. Omitting `status` when creating a course preserves the legacy
default of `published`; Course Content creates new courses as `draft`.

**Important**: for `lessons` and `activities`, a student's GET requests are
additionally filtered so locked-module content never comes back — see
"Module locking enforcement" section below. This isn't optional metadata,
it's the actual security boundary.

### `GET /api/courses/` 🔒 — Any
List all courses.
```json
[{ "id": 1, "title": "Full-Stack Web Development", "description": "...", "instructor": 2, "instructor_name": "Jane Smith", "module_count": 10, "created_at": "..." }]
```

### `POST /api/courses/` 🔒 — Instructor/Admin
```json
{ "title": "Full-Stack Web Development", "description": "...", "status": "draft" }
```
`instructor` is set automatically to whoever's logged in — not accepted
in the request body. `status` may be `draft` or `published` and is optional.

### `POST /api/courses/{id}/save_draft/` 🔒 — Owning Instructor/Admin
Changes the course status to `draft`; students can no longer see or open it.

### `POST /api/courses/{id}/publish/` 🔒 — Owning Instructor/Admin
Publishes only when the course has at least one module, every module has at
least one lesson, and every quiz activity has at least one question. Returns
`400` with the missing requirement otherwise.

### `GET /api/courses/{id}/` 🔒 — Any
Returns the course plus a lightweight list of its modules (no nested
lessons — fetch those separately per module to avoid one giant payload).

### `PUT` / `PATCH` / `DELETE /api/courses/{id}/` 🔒 — Owning instructor/Admin
`403` if the instructor does not teach this course.

### `GET /api/modules/?course={id}` 🔒 — Any (scoped, see Security model)
Module titles/order are visible even when locked for a student — a
student needs to see "React — locked" in a sidebar. Only the *content
inside* a locked module (its lessons/activities) is withheld.
```json
[{ "id": 5, "course": 1, "title": "JavaScript", "order": 3 }]
```

### `POST /api/modules/` 🔒 — Instructor/Admin
```json
{ "course": 1, "title": "JavaScript", "order": 3 }
```
`order` must be unique per course — this is what module-locking checks
against (module 3 unlocks once module 2 is complete).

### `POST /api/modules/reorder/` 🔒 — Owning Instructor/Admin
```json
{ "course": 1, "module_ids": [8, 5, 6] }
```
The IDs must be an exact permutation of the course's modules. Reordering is
transactional and renumbers positions from 1, avoiding unique-index clashes.
`POST /api/modules/{id}/reorder-lessons/` uses `{ "lesson_ids": [12, 10] }`
with the same exact-permutation rule for one module. Deleting a module cascades
to its lessons and dependent content.

### `GET /api/lessons/?module={id}` 🔒 — Any (filtered for students, see below)
```json
[{
  "id": 12, "module": 5, "title": "Functions & Scope", "order": 2,
  "learning_objectives": "...", "video_url": "...", "tutorial_content": "...",
  "activities": [ /* nested ActivitySerializer objects */ ]
}]
```

### `POST /api/lessons/` 🔒 — Instructor/Admin
Accepts JSON for a link-based lesson, or multipart form data with `video_file`
for an uploaded MP4, WebM, OGG, or MOV (up to 500 MB; contents are checked
against the file signature). A lesson may have a video URL or uploaded file,
not both. YouTube and direct video files can report watch progress; Vimeo is
playable but does not report progress.

`GET /api/lessons/{id}/video/` 🔒 streams an uploaded lesson video, supports
HTTP byte ranges for seeking, and follows the same enrollment/module-lock and
course ownership rules as lesson content. Raw `/media/` video paths are not
publicly served.

Lesson resource attachments currently support validated PDF uploads, up to
50 MB, through `/api/lesson-attachments/`; downloads are authenticated and
respect the same course/module permissions.

### `GET /api/activities/?lesson={id}` 🔒 — Any (filtered for students, see below)
```json
[{
  "id": 20, "lesson": 12, "activity_type": "exercise", "title": "Sum two numbers",
  "instructions": "...", "max_score": 100, "max_attempts": 1, "deadline": null,
  "is_required": true, "language": "javascript", "starter_code": "function sum(a, b) {}", "test_cases": [{"input": "2 3", "expected_output": "5", "public": true}]
}]
```
`activity_type` is one of: `exercise`, `lab`, `quiz`, `assignment`.
Student lesson and activity responses include `completion_status` with
`completed`, `not_completed`, or `overdue`. A passing activity completion
takes precedence over its deadline; overdue activities remain incomplete
until the progress service records completion. This field is not returned to
instructors or admins.
Code activities (`exercise` and `lab`) use the persisted `language` setting:
`javascript`, `python`, or `html`; run-tests requests must match it.
JavaScript/Python activities use the Monaco editor and isolated code runner.
HTML activities use Monaco with a restricted in-page preview and do not support
automated runner tests. Activities also support score,
pass threshold, attempt count, required-for-module completion, instructions,
and optional deadline fields. Submitted code and assignment work use
`/api/submissions/` and are graded through `PATCH /api/submissions/{id}/grade/`.

### `POST /api/activities/` 🔒 — Instructor/Admin

---

## Enrollment

### `GET /api/enrollments/` 🔒 — Any
Students see only their own enrollments. Instructors/admins can filter
with `?course={id}` to see everyone enrolled in a course they teach.

### `POST /api/enrollments/` 🔒 — Student only
```json
{ "course": 1 }
```
`student` is set automatically. A non-student calling this gets a `400`
validation error, not silently ignored.

### `DELETE /api/enrollments/{id}/` 🔒 — Student only
Students may unenroll only from their own courses. This revokes course access
but preserves submissions, grades, quiz attempts, and progress records.

---

## Progress / module locking

This is the enforcement layer for brief section 4. Read
`backend/apps/progress/services.py` for the actual logic
(`is_module_unlocked`, `is_module_complete`) — these endpoints just expose
it over HTTP.

### `GET /api/progress/course/{course_id}/` 🔒 — Any
Returns every module in the course with the current user's status.
```json
[
  { "module_id": 5, "title": "HTML Fundamentals", "order": 1, "status": "done" },
  { "module_id": 6, "title": "CSS Fundamentals", "order": 2, "status": "active" },
  { "module_id": 7, "title": "JavaScript", "order": 3, "status": "locked" }
]
```
`status` is one of `done` / `active` / `locked`.

### `GET /api/progress/can-access/{module_id}/` 🔒 — Any
A direct yes/no check, for anything that needs to gate access without
pulling the whole course's progress.
```json
{ "module_id": 7, "unlocked": false }
```

---

## Engagement

Achievement, streak, notification, and certificate records are persisted by
`apps.engagement`. Passing a graded activity or quiz awards activity/course
milestones; verified video watch progress and newly completed activities count
as study days. Repeated events do not duplicate awards or activity-day records.

### `GET /api/engagement/me/` 🔒 — Student
Returns current/longest streaks, the active achievement catalog, and the
student's certificate history. Each achievement includes its database-managed
`name`, `description`, and `category`, plus `metric`, `threshold`, `progress`,
`progress_percent`, and `earned_at` (null until earned). Progress is calculated
from the student's completed activities, completed enrolled courses, or current
study streak, depending on the achievement metric. The catalog definitions can
be managed in Django Admin under **Engagement → Achievements**.

### `GET /api/engagement/notifications/` 🔒 — Any
Returns the caller's 30 most recent notifications and their total `unread_count`.
Notifications are always scoped to the authenticated recipient.

### `PATCH /api/engagement/notifications/{id}/read/` 🔒 — Recipient
Idempotently marks one of the caller's notifications as read. Other recipients'
notification IDs return `404`.

### `POST /api/engagement/notifications/read-all/` 🔒 — Any
Marks all of the caller's unread notifications as read.

### `GET /api/engagement/certificates/?course_id={id}` 🔒 — Owning Instructor/Admin
Lists certificate and revocation history for an authorized course. Admins may omit
`course_id` to list all certificates.

### `POST /api/engagement/certificates/issue/` 🔒 — Owning Instructor/Admin
```json
{ "course_id": 1, "student_id": 4 }
```
The learner must be enrolled and every module must be complete. Course completion
also issues a certificate automatically. The completion timestamp is saved with
the certificate so its printed date remains stable if course content later changes.
Reissuing after revocation creates a new certificate number and retains the revoked record.

### `GET /api/engagement/certificates/{certificate_number}/` 🔒
Returns certificate status and audit fields to its student, the course instructor,
or an admin.

### `GET /api/engagement/certificates/{certificate_number}/download/` 🔒
Downloads a generated PDF. Only issued certificates can be downloaded; revoked
certificates remain viewable in the audit history. The PDF is landscape A4 with
Optimum LMS branding, the learner/course completion date, instructor signature,
and a QR code that links to public certificate verification.

### `GET /api/engagement/certificates/{certificate_number}/verify/`
Public, read-only verification endpoint used by the certificate QR code. Returns
the certificate ID, learner name, course title, completion date, issue time, and
whether the certificate is currently valid. It does not expose account IDs or
revocation notes. The frontend displays the verification result at
`/verify/{certificate_number}`.

### `POST /api/engagement/certificates/{certificate_number}/revoke/` 🔒 — Owning Instructor/Admin
```json
{ "reason": "Completion was awarded in error." }
```
A non-empty reason is required and recorded with the revoking account and time.
If a later grade change invalidates course completion, its active certificate is
automatically revoked with an audit reason.

---

## Submissions

### `GET /api/submissions/?activity={id}&status={status}` 🔒 — Any
Students see only their own. Instructors see only submissions for courses **they teach**
(other IDs `404`). Admins see all. There is **no update or delete** endpoint — a graded record
can't be edited and deleting can't reset the attempt counter.

### `GET /api/submissions/{id}/download/` 🔒
Streams the uploaded file (as an attachment). Same visibility as the record; everyone else `404`.
Raw `/media/` URLs for submissions are never served.

### `POST /api/submissions/` 🔒 — Student only
```json
{ "activity": 20, "content": "...", "github_url": "https://github.com/...", "file": null }
```
Send as JSON, or `multipart/form-data` when attaching a `file`. Server-side checks:
- **Enrollment + module lock**: `403` unless the student is enrolled and the module is unlocked.
- **Attempt limit**: `400` once `activity.max_attempts` is used (enforced under a row lock, so
  parallel requests can't exceed it).
- **Deadline**: `400` after `activity.deadline`.
- **Not a quiz**: quizzes are answered via `/quizzes/{id}/submit/`.
- **Not empty**: needs an answer, a file, or a link.
- **File** (all checked server-side): max **10 MB** (`SUBMISSION_MAX_UPLOAD_MB`); extension allowlist
  (PDF, ZIP, DOCX, PNG/JPG/GIF, and source/text such as .py .js .java .html .css .json .txt .md);
  content must match the extension (magic bytes / valid UTF-8 text); zip archives are bounded
  (≤1000 entries, ≤100 MB expanded) and rejected if they contain `../` or absolute paths.
  A rejected upload does not use up an attempt. Upload rate limit: 30/hour per user.

Response includes `attempt_number` (server-assigned, not something you
send) and `status: "submitted"`.

### `PATCH /api/submissions/{id}/grade/` 🔒 — Instructor/Admin
```json
{ "grade": 9, "feedback": "Solid work, watch your indentation." }
```
`grade` must be between 0 and the activity's `max_score`. A grade of at least
`activity.pass_percentage` (default 50%) of `max_score` marks the activity **complete**, which is
what can unlock the next module; a lower grade does **not**. An activity counts as complete if *any*
graded attempt passes; downgrading the only passing attempt un-completes it. The response includes
`activity_completed`. `404` if the submission belongs to a course the caller doesn't teach.

---

## Quizzes

### `GET /api/quizzes/?activity={id}` 🔒 — Any
Students get `QuestionForStudentSerializer` shape — **`correct_choice_index`
is never sent to a student**, only `choices` (the options) and `text`.
```json
{
  "id": 3, "activity": 22, "time_limit_minutes": 10, "pass_mark_percentage": 70,
  "questions": [{ "id": 1, "text": "Which property sets text color?", "marks": 1, "choices": [{"text": "background-color"}, {"text": "color"}] }]
}
```

### `POST /api/quizzes/` 🔒 — Instructor/Admin
```json
{ "activity": 22, "time_limit_minutes": 10, "pass_mark_percentage": 70 }
```
Questions are managed through `POST /api/quiz-questions/` (Instructor/Admin).

### `POST /api/quizzes/build/` 🔒 — Owning Instructor/Admin
Atomically creates a quiz activity, quiz settings, and its questions in one
request. If any question fails validation, none of those records are kept.

### `POST /api/quizzes/{quiz_id}/submit/` 🔒 — Student only
```json
{ "answers": { "1": 1, "2": 0 } }
```
Keys are question IDs (as strings, since JSON object keys are always
strings), values are the chosen choice's index.

Auto-graded immediately. Response:
```json
{ "id": 8, "student": 4, "quiz": 3, "attempt_number": 1, "answers": {"1": 1}, "score": 1, "total_marks": 1, "percentage": 100.0, "passed": true, "submitted_at": "..." }
```
If `passed` is `true`, the underlying activity is marked complete —
verified live: a wrong answer does not unlock the next module, a
subsequent correct attempt (within `max_attempts`) does.

Same module-lock and attempt-limit checks as submissions, enforced the
same way.

### `GET /api/quiz-questions/?quiz={id}` 🔒 — Instructor/Admin
Lists the quiz's questions, including `correct_choice_index` for authoring.
Students cannot call this endpoint. Question CRUD is available to the owning
instructor/admin; fields are `quiz`, `text`, `marks`, `choices`, and
`correct_choice_index`.

### `GET /api/quiz-attempts/?quiz={id}&student={id}` 🔒 — Any
Read-only attempt history. Students are always scoped to their own attempts;
instructors see only attempts in courses they teach; admins can see all.
Optional `quiz` and `student` filters narrow that visibility.

---

## Code execution

A defensive client for an **isolated runner** (`SANDBOX_URL`, reference implementation in
`/sandbox`). Django never executes student code. Requests carry a shared secret
(`X-Sandbox-Token` ← `SANDBOX_TOKEN`) and the runner's port is never published. If the runner is
unreachable the endpoints return a generic `503` (internal details are logged, not returned).

Limits enforced here: languages `python` / `javascript` only; code ≤ 20,000 chars; stdin ≤ 10,000;
output truncated to 10,000 chars; **30 runs/minute per user**; only `{language, code, stdin}` are
forwarded (a client cannot pass timeouts, memory limits or flags). The runner itself enforces CPU,
wall-clock, memory, process and output limits — see `sandbox/README.md` for what is and isn't verified.

### `POST /api/execute/run/` 🔒 — Any authenticated user
```json
{ "language": "python", "code": "print(1+1)", "stdin": "" }
```
→ `{ "stdout": "2\n", "stderr": "", "exit_code": 0, "timed_out": false }`

### `POST /api/execute/test/` 🔒 — Enrolled student (module unlocked) / teaching instructor / admin
```json
{ "language": "python", "code": "...", "activity_id": 20 }
```
Runs the code once per test case (`input` → stdin) and compares stdout with `expected_output`
**inside Django** — expected outputs are never sent to the runner. Only `exercise`/`lab` activities.
```json
{ "passed": 1, "total": 2, "score": 50.0,
  "results": [ {"index": 1, "passed": true, "input": "hi", "expected_output": "hi", "actual_output": "hi"},
               {"index": 2, "passed": false, "timed_out": false} ] }
```
Students see per-case details only for cases an instructor marked `"public": true`; hidden cases
return pass/fail only. Staff see everything. Students without access get `404`.

---

## Dashboards

Read-only aggregation — these don't own any data, just assemble it from
the apps above. Field shapes below are exactly what
`StudentDashboard.jsx` / `InstructorDashboard.jsx` consume.

### `GET /api/dashboard/student/` 🔒 — Any
```json
{
  "enrolled_courses": [
    {
      "course_id": 1,
      "course_title": "Database Course",
      "progress_percent": 33,
      "current_module": "Queries",
      "current_module_id": 2,
      "current_lesson_id": 5,
      "current_lesson_title": "Filtering rows",
      "completed": false,
      "modules": [
        { "module_id": 1, "title": "Tables", "order": 1, "status": "done" },
        { "module_id": 2, "title": "Queries", "order": 2, "status": "active" },
        { "module_id": 3, "title": "Joins", "order": 3, "status": "locked" }
      ]
    }
  ],
  "current_course": {
    "course_id": 1,
    "course_title": "Database Course",
    "progress_percent": 33,
    "current_module": "Queries",
    "current_module_id": 2,
    "current_lesson_id": 5,
    "current_lesson_title": "Filtering rows",
    "completed": false,
    "modules": [
      { "module_id": 1, "title": "Tables", "order": 1, "status": "done" },
      { "module_id": 2, "title": "Queries", "order": 2, "status": "active" },
      { "module_id": 3, "title": "Joins", "order": 3, "status": "locked" }
    ]
  },
  "pending_labs": 2,
  "recent_grades": [
    { "activity": "Query exercise", "grade": 90, "feedback": "Solid work." }
  ],
  "upcoming_deadlines": [
    { "activity_id": 8, "title": "Filtering practice", "activity_type": "assignment", "course_id": 1, "course_title": "Database Course", "deadline": "..." }
  ]
}
```
Module status is `done`, `active`, or `locked`. Deadlines are limited to enrolled courses, incomplete activities, and unlocked modules; at most five are returned.

### `GET /api/dashboard/instructor/` 🔒 — Instructor/Admin
```json
{
  "pending_submissions": [
    { "submission_id": 14, "student": "Brian Kimani", "activity": "CSS Flexbox Lab", "course": "Full-Stack Web Development", "submitted_at": "..." }
  ],
  "pending_submission_count": 14,
  "students_falling_behind": [
    { "student": "David Mwangi", "course": "Full-Stack Web Development" }
  ],
  "my_courses": [{ "id": 1, "title": "Full-Stack Web Development" }]
}
```
"Falling behind" = enrolled, but no completed activity in the last 7
days. See `backend/README.md` for the scaling caveat on this query.

### `GET /api/dashboard/admin/` 🔒 — Admin only
```json
{
  "total_students": 128, "total_instructors": 6, "total_courses": 4,
  "active_enrollments": 340, "pending_submissions": 22
}
```

---

## Adaptive sequencing and instructor risk

### `GET /api/sequencing/me/` 🔒 — Any authenticated user
Returns a `recommendations` array with one item per enrolled course that has
an active, unlocked module. Each item includes `course_id`, `course_title`,
`current_module`, `current_module_mastery` (0–100 or `null`), `pace`
(`reinforce`, `steady`, or `accelerate`), `recommendation`, and
`mastery_by_module`. Recommendation actions include `review`, `continue`,
`practice_first`, and `advance`. These suggestions do not override the
server-enforced module access rules.

### `GET /api/risk/cohort/` 🔒 — Instructor/Admin
Scores enrolled students in courses the instructor teaches; admins receive
the whole platform cohort. Response:
```json
{
  "scored": [{
    "student_id": 4, "course_id": 1, "student_name": "Brian Kimani",
    "course_title": "Database Course", "student_health_score": 80,
    "risk_level": "low", "risk_probability": 0.1,
    "top_factors": ["Recent average score is strong"],
    "recommended_action": "On track — no action needed."
  }],
  "skipped_insufficient_history": []
}
```
Students need at least three weekly performance snapshots to be scored.
Those with insufficient history appear in `skipped_insufficient_history`.
`503` means the optional model is unavailable. The model is trained on
synthetic data at present: treat these scores as an instructor prompt, not
as an authoritative academic decision.

### `GET /api/risk/student/{student_id}/course/{course_id}/` 🔒 — Instructor/Admin
Returns one student's risk card with `student_id`, `course_id`,
`student_health_score`, `risk_level`, `risk_probability`, `top_factors`,
and `recommended_action`. Instructors may request only students enrolled in
their own courses. A `204` response means there is not enough history yet;
render it as "not scored" and do not attempt to parse a response body.

### `GET /api/allocation/recommendations/` 🔒 — Admin only
Returns `{ "average_instructor_load", "instructor_loads", "course_metrics", "recommendations" }`.
Recommendations are transparent workload heuristics, with `type` values
such as `single_course_overload`, `backlog`, and `rebalance`; each includes
priority, a human-readable reason, and supporting metrics. This endpoint is
read-only and does not reassign courses or instructors.

---

## Module-locking enforcement (read this before building against locked content)

Three separate places check `is_module_unlocked()`, all verified by direct
testing (not just written and assumed correct):

1. **`GET /api/lessons/` and `/api/activities/`** — a student's queryset is
   filtered to only unlocked modules. A locked lesson fetched directly by
   ID returns `404` (not `403` — deliberately doesn't confirm the lesson
   exists to someone probing IDs).
2. **`POST /api/submissions/`** — rejected with `403` if the activity's
   module is locked, even if the student already knows the activity ID.
3. **`POST /api/quizzes/{id}/submit/`** — same `403` check.

If you add a new way to read or write activity-linked content, apply the
same check — import `is_module_unlocked` from
`apps.progress.services` and use the existing pattern in
`apps/submissions/views.py` as a template.

---

## Video progress

### `GET|PUT /api/progress/video/{lesson_id}/` 🔒 — Student only
Lesson videos must be an **https YouTube link (with a valid 11-char id), a Vimeo link, or a direct
.mp4/.webm/.ogg/.mov file** — enforced when an instructor saves the lesson. Progress is tracked for
YouTube and direct files (not Vimeo). `404` unless enrolled and the module is unlocked.

`PUT` body: `{ "position": 12.5, "duration": 600, "playing": true, "rate": 1 }` (seconds; sent about
every 10 s while playing and on pause/seek/close). Returns
`{ "position", "duration", "watched_seconds", "percent", "completed" }`.

Watch time is credited only when the position advanced about as fast as real time since the previous
heartbeat (≤ `rate × 1.25`), so **seeking or fast-forwarding earns nothing**, paused/sleeping tabs earn
nothing, and re-watching isn't double counted (ranges are merged). `completed` at 90 % of real watch
time and never reverts. `position` is only the resume point. Limit: `duration` is player-reported, so a
student could under-report it to complete early — this only affects their own analytics, since nothing
(grades, unlocks) depends on video completion. Rate limit: 120 PUT/min per user.

### `GET /api/progress/video/{lesson_id}/summary/` 🔒 — Teaching instructor/Admin
Per-student `percent` / `completed` for every enrolled student. `403` for a course the caller doesn't teach.

---

## Security model (summary)

Every endpoint checks the **role** and the **specific record**. Rows a caller may not see are
filtered out (lists) or `404` (detail); acting on a visible-but-forbidden record is `403`.

| Caller | Can access |
|---|---|
| Student | Own enrollments/submissions/attempts; content only in courses they are **enrolled** in and modules they have **unlocked**. Never receives `test_cases` or quiz answers. |
| Instructor | Only courses where `Course.instructor` is them: write content, see enrollments, submissions, quiz attempts, video stats, risk scores. Cannot edit, grade or read another instructor's course. |
| Admin | Everything. |

`GET /api/modules/` returns titles/order only to students (no lesson content). Lesson PDFs are
served by `GET /api/lesson-attachments/{id}/download/` with the same checks as the lesson; the
`lesson-attachments` and `submissions` folders are never exposed under `/media/`.

Regression tests: `apps/accounts/tests_permissions.py` (45 cases).

## Deployment notes that affect login

- `NUM_PROXIES` — set to the number of reverse proxies (1 behind the bundled nginx). At the default `0`
  behind a proxy, every user appears to come from the proxy's IP and the 10/min login limit locks everyone out.
- Email must work for new users to verify. If SMTP is down: `python manage.py verify_users --all`
  (or specific emails; `--set-password` for one user) unblocks accounts without email.
- `SANDBOX_TOKEN` unset ⇒ a warning, code execution refuses requests; login is unaffected.

## Known gaps (as of this doc)

- Quiz `time_limit` is not enforced server-side (no "start attempt" endpoint).
- The code runner's container-level isolation (no network, read-only FS) must be verified on the
  deployment host — see `sandbox/README.md`.

For anything not covered here, the Django admin (`/admin/`) exposes every
model directly and is the fastest way to inspect real data while
building against this API.
