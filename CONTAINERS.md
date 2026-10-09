# Running in containers

**What runs where**

| Piece | Where | Why |
|---|---|---|
| React app (nginx) | container `frontend`, port **8080** | static files + reverse proxy to the API |
| Django API (gunicorn) | container `backend`, not published | only reachable through nginx |
| Code runner | container `sandbox`, **internal network only** | untrusted code never touches the internet, DB or your files |
| **Microsoft SQL Server** | **outside Docker** (host or a managed server) | the application connects through ODBC; data survives container rebuilds |

Containers hold code + dependencies only. Secrets are read from `backend/.env.docker` at start-up
(git-ignored, excluded from the image by `.dockerignore`). Never bake passwords into an image.
The frontend image uses a repository-root build context so it can include the shared `images/`
logo assets; the root `.dockerignore` limits that context to the frontend and those assets.

## First run

```bash
cp backend/.env.docker.example backend/.env.docker      # fill in real values
printf 'SANDBOX_TOKEN=%s\n' "$(openssl rand -hex 32)" > .env # git-ignored Compose settings
docker compose up --build -d
docker compose run --rm backend python manage.py migrate # NEW migrations are included — run this
docker compose run --rm backend python manage.py createsuperuser   # if you need one
```

Open http://localhost:8080. For a quick **local trial over plain http** set `DJANGO_DEBUG=True` in
`.env.docker` (production mode requires https `FRONTEND_URL`, real SMTP settings and SQL Server settings).
For a real deployment put a TLS terminator (Caddy, Traefik, your cloud load balancer) in front of
port 8080 and set `DJANGO_DEBUG=False`, `DJANGO_ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `FRONTEND_URL`.

### Windows PowerShell

Docker Desktop's WSL 2 backend does not require a separate Ubuntu distribution. Start Docker Desktop
and wait for its engine to be running, then check it from PowerShell:

```powershell
docker info
docker run --rm hello-world
```

Create the local settings file and edit it with the actual Django, SQL Server, and (if used) email
settings. Do not leave the example placeholder values in place:

```powershell
Copy-Item backend/.env.docker.example backend/.env.docker
notepad backend/.env.docker
```

Save one sandbox token in the ignored root `.env` file. Compose loads it for both backend and
sandbox on every command; do not generate a different token per PowerShell command or the services
will no longer authenticate to each other.

```powershell
$tokenBytes = [byte[]]::new(32)
$rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($tokenBytes)
$token = [Convert]::ToBase64String($tokenBytes)
$rng.Dispose()
Set-Content -Path .env -Value "SANDBOX_TOKEN=$token" -NoNewline -Encoding ascii

docker compose up --build -d
docker compose run --rm backend python manage.py migrate
docker compose run --rm backend python manage.py createsuperuser
```

Keep `.env` private; it contains the shared code-runner secret. To rotate the token, generate a new
one and recreate both services with `docker compose up -d`.

`MSSQL_DB_HOST=host.docker.internal` in the settings file reaches SQL Server on this Windows host.
SQL Server must have TCP/IP enabled, accept SQL authentication, and allow connections from Docker.
If `docker info` cannot connect, confirm Docker Desktop is running and its engine has finished
starting before retrying.

## Reaching your SQL Server from a container

- `MSSQL_DB_HOST=host.docker.internal` reaches SQL Server on the Docker host (compose maps it for Linux too).
  For a remote server use its hostname/IP.
- SQL Server must accept **TCP connections on 1433** (SQL Server Configuration Manager → TCP/IP enabled),
  use **SQL authentication** (the container can't use Windows login), and your firewall must allow the Docker
  network to reach it. `Encrypt=yes;TrustServerCertificate=yes` is fine for a local server without a trusted cert.
- You manage the database; the app only needs a login with rights on its own database.

## Things that can lock people out — already handled, but know them

- **`NUM_PROXIES=1`** (set in `docker-compose.yml`). Without it every user shares nginx's IP and the 10/min login
  throttle blocks the whole school. Keep it if you change the proxy layout (count your proxies).
- **Email must work** or new users can't verify. Break-glass without email:
  `docker compose exec backend python manage.py verify_users --all` (or specific addresses;
  `--set-password` for one user).
- A missing `SANDBOX_TOKEN` only disables code execution; login is unaffected.

## Deployment checks

After the first `up`, verify the built services and confirm the sandbox remains isolated and
read-only with the checks in `sandbox/README.md`. Compose startup also requires a configured
`backend/.env.docker` and a non-empty `SANDBOX_TOKEN`.
