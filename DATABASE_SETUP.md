# Microsoft SQL Server Setup — Optimum ERP LMS

Microsoft SQL Server is the only supported database for development and production. Django migrations are provider-neutral and use the custom `config.mssql` backend.

> **Current configuration limitation:** `backend/config/settings.py` currently
> forces `Trusted_Connection=yes` and leaves the database username, password,
> and port blank. Although the example environment files and deployment
> guides list SQL-auth settings, the current connection does not consume those
> values. Native Windows development needs a trusted SQL Server identity.
> Docker/Linux and SQL-auth production deployments are not ready until the
> Django database configuration is updated to support the intended
> authentication mode.

## Local setup

1. Install SQL Server or use an existing reachable SQL Server instance.
2. Install Microsoft ODBC Driver 18 for SQL Server on the machine running Django.
3. Copy `backend/.env.example` to `backend/.env` and configure:

   ```text
   MSSQL_DB_NAME=optimum_erp_lms
   MSSQL_DB_USER=<application login>
   MSSQL_DB_PASSWORD=<secret>
   MSSQL_DB_HOST=localhost
   MSSQL_DB_PORT=1433
   MSSQL_ODBC_DRIVER=ODBC Driver 18 for SQL Server
   MSSQL_EXTRA_PARAMS=Encrypt=yes;TrustServerCertificate=yes;
   ```

4. Ensure the database exists and the application login can create/update objects in its schema.
5. From `backend/`, run `python manage.py check`, `python manage.py migrate`, then `python manage.py createsuperuser`.

For trusted certificates, use `TrustServerCertificate=no`. Keep certificate validation enabled in production.

## Code runner for a native Windows backend

The code editor sends Python/JavaScript to the isolated runner; it never executes student code in Django.
The reference runner requires a Linux container and must not be started directly on Windows. Install and
start Docker Desktop with its Linux/WSL2 engine enabled, then:

1. Generate a private token in PowerShell:

   ```powershell
   $token = & .\.venv\Scripts\python.exe -c "import secrets; print(secrets.token_hex(32))"
   ```

2. Add `SANDBOX_TOKEN=<generated token>` to `backend/.env` and save the file. Do not commit or share it.
3. From the repository root, start the local-only runner:

   ```powershell
   docker compose --env-file backend/.env -f docker-compose.runner.yml up --build -d
   ```

4. Restart Django so it loads the same token. The runner health check should pass, and Django uses
   `http://localhost:9000` by default.

This development-only Compose file publishes the runner on `127.0.0.1:9000` so native Django can reach it.
Student programs still run in a read-only, non-root Linux container on an internal network without outbound
network access. Production should use the private runner network in `docker-compose.yml`; do not publish
the sandbox port there.

## Docker

Set `MSSQL_DB_HOST` in `backend/.env.docker`. `host.docker.internal` reaches SQL Server on the Docker host; remote SQL Server instances should use their private hostname. SQL Server remains outside the Compose stack and its TCP port is not published by this project.

```powershell
Copy-Item backend/.env.docker.example backend/.env.docker
$env:SANDBOX_TOKEN = (python -c "import secrets; print(secrets.token_hex(32))")
docker compose up --build -d
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

## Existing SQLite data

Removing SQLite configuration or its file does not import its records into SQL Server. If an existing SQLite file contains users, courses, enrollments, submissions, or progress, back it up and perform a rehearsed data export/import before deleting it. Verify record counts, foreign keys, uploaded-media paths, credentials, and user flows against SQL Server. Keep a rollback backup until the cutover has been accepted.

## Troubleshooting

- **Connection refused/timeouts:** confirm SQL Server TCP/IP is enabled, the server is listening on the configured port, and firewalls allow the backend host.
- **Login failed:** verify the database name and SQL login permissions; do not use `sa` for the application.
- **ODBC driver not found:** install ODBC Driver 18 on the backend host/container and confirm `MSSQL_ODBC_DRIVER` matches its installed name.
- **Certificate errors:** configure the correct CA trust chain. Do not suppress certificate validation in production.
- **Missing tables:** run `python manage.py showmigrations` and the deployment migration job.
