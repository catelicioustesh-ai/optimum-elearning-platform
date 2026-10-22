# Optimum ERP LMS

A web-based coding e-learning platform — LMS + assessment platform in one.
Structured lessons, an in-browser code editor, daily labs, quizzes, and
server-enforced module progression.

```
optimum-erp-lms/
├── backend/          Django + DRF API, domain apps, and integrated risk engine
├── frontend/         React + Vite + Tailwind web app
├── sandbox/          Isolated code execution service
├── risk-engine/      Risk model development pipeline and training assets
├── docs/             API reference, architecture, and frontend handoff
└── DATABASE_SETUP.md SQL Server setup and migration guidance
```

## Platform features

- Student and instructor registration, email verification, and admin approval.
- Email/password login, with optional Google, Microsoft, and Apple sign-in
  when provider credentials and origins are configured.
- Role-specific student, instructor, and admin workspaces. Admin account
  review includes email verification, approval, suspension, and reactivation.
- Courses, lessons, quizzes, submissions, grading, progress, and
  server-enforced module unlocking.
- Student community discussions, instructor dashboards, allocation
  recommendations, and early-warning risk insights.
- Isolated code execution for Python, JavaScript, C, C++, and Java; HTML
  activities are preview-only. Code execution requires the separate sandbox
  service and is subject to its resource limits.

## Quick start (local development)

### macOS / Linux (bash)
```bash
# 1. Backend
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# 2. Frontend — in a second terminal
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

### Windows (PowerShell)
```powershell
# 1. Backend
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver

# 2. Frontend — in a second terminal
cd frontend
npm install
Copy-Item .env.example .env.local
npm run dev
```

**If `Activate.ps1` fails with "running scripts is disabled on this system"**: PowerShell
blocks script execution by default. Run this once (as your normal user, not admin):
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Then re-run the activate command. This only relaxes the policy for your user account, not
system-wide.

### Windows (cmd.exe)
Same as PowerShell above, except activation is:
```cmd
venv\Scripts\activate.bat
```
and use `copy` instead of `Copy-Item`:
```cmd
copy .env.example .env
```

## Run the complete app with Docker

If you want the frontend, API, and isolated code runner to start together, use
Docker Compose instead of starting `runserver` and Vite in separate terminals:

1. Start Docker Desktop and wait until its engine is ready.
2. From the repository root, copy `backend/.env.docker.example` to
   `backend/.env.docker` and set the local Django and SQL Server settings.
   For SQL Server running on this Windows PC, set `MSSQL_DB_HOST=host.docker.internal`.
3. Follow the one-time `SANDBOX_TOKEN` setup in [CONTAINERS.md](./CONTAINERS.md),
   then start the stack:

   ```powershell
   docker compose up --build -d
   docker compose ps
   ```

   The app is at **http://localhost:8080**. After pulling changes that include
   database migrations, run `docker compose run --rm backend python manage.py migrate`.
   Stop the containers with `docker compose down`; your SQL Server database is
   outside Compose and is not removed.

Docker Desktop can be configured to start when you sign in to Windows, but the
project stack still needs `docker compose up -d` after the engine is ready. Do
not also run the native Django and Vite servers while using the Compose stack.
For the native quick start above, Docker is only needed for the separate code
runner described below.

## Local code runner

The **Run** and **Run tests** buttons require the isolated sandbox service. The
native Django development server does not start it. Set `SANDBOX_TOKEN` in
`backend/.env` to a long random secret (do not leave it blank), then, from the
repository root with Docker running, start the sandbox:

```sh
docker compose --env-file backend/.env -f docker-compose.runner.yml up --build -d
```

Keep `SANDBOX_URL=http://localhost:9000` in `backend/.env`. If you changed the
token while Django was already running, restart `python manage.py runserver`
so it reads the new value. Without a configured token or a reachable sandbox,
`POST /api/execute/run/` returns `503 CODE_RUNNER_UNAVAILABLE`.

Frontend: `http://localhost:5173`
Backend API: `http://localhost:8000/api`
Django admin: `http://localhost:8000/admin`

## Database

The backend uses Microsoft SQL Server in every environment. Install ODBC Driver 18 and configure the `MSSQL_*` settings in `backend/.env`; see **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** for local, Docker, production, and existing-data migration steps.

## Security notes

- Module locking (a student can't access content or submit work for a
  module they haven't unlocked) is enforced **server-side**, verified by
  testing direct API access — see `backend/README.md` for what was tested.
- Public registration supports learner and instructor roles. New accounts
  must verify their email and receive administrator approval before sign-in.
  Admin/staff accounts are provisioned through Django admin by a trusted
  administrator.
- Login/register are rate-limited (10/minute) against brute-force attempts.
- HTTPS, HSTS, and secure cookies auto-enable in production
  (`DJANGO_DEBUG=False`) — see `backend/config/settings.py`.

## Project credit

Project credit: **Brian Otieno Obonyo** and **attachees sep-dec 2026 cohort**

## Further reading

- **[docs/FRONTEND_HANDOFF.md](./docs/FRONTEND_HANDOFF.md)** — frontend
  connection setup, authentication lifecycle, full route inventory, and
  integration boundaries
- **[docs/API_REFERENCE.md](./docs/API_REFERENCE.md)** — every endpoint,
  request/response shapes, auth requirements, and exactly how
  module-locking is enforced server-side (verified against the actual
  code, not written from memory)
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** — system diagrams,
  why the backend is split the way it is, data model, deployment topology
- `backend/README.md` — implemented backend features and operational
  follow-up, plus the permission
  pattern used across every app
- `DATABASE_SETUP.md` — SQL Server configuration and safe data migration
