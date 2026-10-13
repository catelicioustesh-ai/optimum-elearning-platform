# Code runner (reference implementation)

`runner.py` executes one untrusted Python, JavaScript, C, C++, or Java program per request. Django
(`apps/execution`) is the only intended caller.

## Layers of isolation

| Layer | Provided by | Verified how |
|---|---|---|
| CPU / wall-clock / file-size / open-files / process limits, output cap, wiped env, throwaway cwd, kill whole process group | `runner.py` | `test_runner.py` (adversarial, run against a non-root runner) |
| **No network** (`network_mode: none` / internal network) | docker-compose | **Not testable in the dev sandbox — verify on your host** (see below) |
| Non-root user, read-only root FS, `cap_drop: ALL`, `no-new-privileges` | docker-compose | verify on your host |
| Memory & pids ceiling (cgroups), so a bomb can't take the host | docker-compose `mem_limit`, `pids_limit` | verify on your host |
| Caller authentication | `X-Sandbox-Token` shared secret; production port never published | `test_runner.py` |

For a native Django development server on Windows, use the optional
`docker-compose.runner.yml` override. It publishes only a loopback-bound TCP
relay at `127.0.0.1:9000`; the untrusted runner remains on the internal,
non-internet-connected `runner_net` and has no host-published port. The relay
forwards only to `sandbox:9000`.

```bash
docker compose -f docker-compose.yml -f docker-compose.runner.yml up --build
```

Configure the native backend with `SANDBOX_URL=http://127.0.0.1:9000`. The
normal Compose stack does not need this relay because its backend reaches the
runner directly over `runner_net`.

C17 and C++17 sources are compiled in a per-request `/run-code` scratch directory,
and Java sources are compiled as `Main.java` before execution. This size-limited,
per-container tmpfs mount allows execution of compiler output while `/tmp` remains
`noexec`; each request's files are removed after it finishes.

`runner.py` alone is NOT a sandbox against a determined attacker: a Python
process can still try to open sockets or read world-readable files. The
container flags are what contain that. For higher assurance (many untrusted
users), put gVisor/Firecracker under the container or use a hosted engine such
as Judge0/Piston instead of this file.

## Verify on your host after `docker compose up`

```bash
# 1. no network:
docker compose exec sandbox python -c "import socket;socket.create_connection(('1.1.1.1',53),3)"   # must fail
# 2. read-only root, non-root:
docker compose exec sandbox sh -c "id -u; touch /x"                                               # 10001, then 'Read-only file system'
# 3. adversarial suite (from a container on the same network):
docker compose run --rm -e RUNNER_URL=http://sandbox:9000 -e SANDBOX_TOKEN=$SANDBOX_TOKEN backend python /sandbox/test_runner.py
```

## Known limits
* Code activities support Python, JavaScript, C, C++, Java, and HTML (HTML is preview-only). Add a language by extending `LANGUAGES` and installing its runtime in the image.
* The server runs 4 programs at a time (`MAX_CONCURRENT`) and answers 429 when busy; Django rate-limits per user (30/min).
* Time/memory/process limits are per run and configurable via env (`RUN_WALL_SECONDS`, `RUN_MEMORY_MB`, ...).
