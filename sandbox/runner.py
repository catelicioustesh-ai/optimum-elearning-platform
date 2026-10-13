#!/usr/bin/env python3
"""Reference code-execution runner (stdlib only).

Runs ONE untrusted program per request. Defence in depth — this file is only
the inner layer; the container flags in docker-compose.yml / README.md are the
outer layers and are what actually provide network and filesystem isolation.

Inner layer (this file), per run:
  * fresh empty temp dir as cwd, deleted afterwards
  * new process group, killed as a whole on timeout (no orphaned children)
  * rlimits: CPU seconds, address space (Python), file size, open files,
    processes, core dumps disabled
  * wall-clock timeout, stdout/stderr capped (a `while True: print()` flood
    can't fill memory)
  * environment wiped (no SANDBOX_TOKEN, no cloud credentials) and HOME set
    to the temp dir
  * request body capped; shared-secret header required; concurrency capped

NOT provided by this file (must come from the container): network blocking,
read-only root filesystem, dropping capabilities, cgroup memory/pids limits.
"""
import json
import os
import resource
import shutil
import signal
import subprocess
import sys
import tempfile
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = os.environ.get("SANDBOX_TOKEN", "")
PORT = int(os.environ.get("PORT", "9000"))
WALL_SECONDS = float(os.environ.get("RUN_WALL_SECONDS", "5"))
CPU_SECONDS = int(os.environ.get("RUN_CPU_SECONDS", "3"))
MEMORY_MB = int(os.environ.get("RUN_MEMORY_MB", "128"))
MAX_OUTPUT = int(os.environ.get("RUN_MAX_OUTPUT_BYTES", str(64 * 1024)))
MAX_BODY = 64 * 1024
MAX_CONCURRENT = int(os.environ.get("MAX_CONCURRENT", "4"))
MAX_PROCS = int(os.environ.get("RUN_MAX_PROCS", "32"))
RUN_TEMP_DIR = os.environ.get("RUN_TEMP_DIR", tempfile.gettempdir())

LANGUAGES = {
    "python": {
        "filename": "main.py",
        "command": [sys.executable, "-I", "-B", "main.py"],
        "limit_address_space": True,
    },
    "javascript": {
        "filename": "main.js",
        "command": ["node", f"--max-old-space-size={MEMORY_MB}", "main.js"],
        "limit_address_space": False,
    },
    "c": {
        "filename": "main.c",
        "compile": ["gcc", "-std=c17", "-O0", "-pipe", "-fno-diagnostics-color", "main.c", "-o", "program"],
        "command": ["./program"],
        "limit_address_space": True,
    },
    "cpp": {
        "filename": "main.cpp",
        "compile": ["g++", "-std=c++17", "-O0", "-pipe", "-fno-diagnostics-color", "main.cpp", "-o", "program"],
        "command": ["./program"],
        "limit_address_space": True,
    },
    "java": {
        "filename": "Main.java",
        "compile": ["javac", "-J-Xmx128m", "-J-XX:+UseSerialGC", "-proc:none", "Main.java"],
        "compile_cpu_seconds": 20,
        "compile_wall_seconds": WALL_SECONDS * 4,
        "command": [
            "java", "-Xms16m", "-Xmx128m", "-XX:MaxMetaspaceSize=96m",
            "-XX:ReservedCodeCacheSize=24m", "-XX:+UseSerialGC",
            "-XX:ActiveProcessorCount=1", "-cp", ".", "Main",
        ],
        "limit_address_space": False,
        "cpu_seconds": 10,
    },
}
slots = threading.BoundedSemaphore(MAX_CONCURRENT)


def _limits(limit_address_space, cpu_seconds=CPU_SECONDS):
    def apply():
        os.setsid()
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 1))
        resource.setrlimit(resource.RLIMIT_FSIZE, (1 << 20, 1 << 20))
        resource.setrlimit(resource.RLIMIT_NOFILE, (64, 64))
        resource.setrlimit(resource.RLIMIT_CORE, (0, 0))
        resource.setrlimit(resource.RLIMIT_NPROC, (MAX_PROCS, MAX_PROCS))  # ineffective for root: run as non-root
        if limit_address_space:
            limit = MEMORY_MB * 1024 * 1024
            resource.setrlimit(resource.RLIMIT_AS, (limit, limit))
    return apply


def _read_capped(stream, sink, cap):
    total = 0
    while True:
        chunk = stream.read(4096)
        if not chunk:
            break
        if total < cap:
            sink.append(chunk[: cap - total])
        total += len(chunk)          # keep draining so the child never blocks on a full pipe
    return total > cap


def _run_process(
    argv, workdir, env, stdin, limit_address_space, wall_seconds,
    cpu_seconds=CPU_SECONDS,
):
    proc = subprocess.Popen(
        argv, cwd=workdir, env=env, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        preexec_fn=_limits(limit_address_space, cpu_seconds),
        close_fds=True,
    )
    out, err, flags = [], [], {}
    t_out = threading.Thread(target=lambda: flags.__setitem__("o", _read_capped(proc.stdout, out, MAX_OUTPUT)))
    t_err = threading.Thread(target=lambda: flags.__setitem__("e", _read_capped(proc.stderr, err, MAX_OUTPUT)))
    t_out.start(); t_err.start()
    try:
        proc.stdin.write(stdin.encode("utf-8", "replace")[:MAX_BODY]); proc.stdin.close()
    except (BrokenPipeError, OSError):
        pass
    timed_out = False
    try:
        proc.wait(timeout=wall_seconds)
    except subprocess.TimeoutExpired:
        timed_out = True
    finally:
        try:
            os.killpg(proc.pid, signal.SIGKILL)   # also reaps any children it spawned
        except (ProcessLookupError, PermissionError):
            pass
        proc.wait()
    t_out.join(2); t_err.join(2)
    code_ = proc.returncode
    return {
        "stdout": b"".join(out).decode("utf-8", "replace"),
        "stderr": b"".join(err).decode("utf-8", "replace"),
        "exit_code": None if timed_out else code_,
        "timed_out": timed_out,
        "truncated": bool(flags.get("o") or flags.get("e")),
        "signal": -code_ if (code_ is not None and code_ < 0 and not timed_out) else None,
    }


def run_program(language, code, stdin):
    config = LANGUAGES[language]
    workdir = tempfile.mkdtemp(prefix="run_", dir=RUN_TEMP_DIR)
    try:
        with open(os.path.join(workdir, config["filename"]), "w", encoding="utf-8") as fh:
            fh.write(code)
        env = {"PATH": "/usr/local/bin:/usr/bin:/bin", "HOME": workdir, "LANG": "C.UTF-8"}
        if "compile" in config:
            compiled = _run_process(
                config["compile"], workdir, env, "", False,
                config.get("compile_wall_seconds", WALL_SECONDS * 2),
                config.get("compile_cpu_seconds", CPU_SECONDS),
            )
            if compiled["timed_out"] or compiled["exit_code"] != 0:
                return compiled
        return _run_process(
            config["command"], workdir, env, stdin,
            config["limit_address_space"], WALL_SECONDS,
            config.get("cpu_seconds", CPU_SECONDS),
        )
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


class Handler(BaseHTTPRequestHandler):
    server_version = "runner"
    def log_message(self, *a):  # never log code or output
        pass

    def _send(self, status, obj):
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._send(200, {"ok": True}) if self.path == "/health" else self._send(404, {"error": "not found"})

    def do_POST(self):
        if self.path != "/run":
            return self._send(404, {"error": "not found"})
        supplied = self.headers.get("X-Sandbox-Token", "")
        if not TOKEN or not _consteq(supplied, TOKEN):
            return self._send(401, {"error": "unauthorized"})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self._send(400, {"error": "bad length"})
        if length <= 0 or length > MAX_BODY:
            return self._send(413, {"error": "body too large"})
        try:
            req = json.loads(self.rfile.read(length))
            language, code, stdin = req["language"], req["code"], req.get("stdin", "")
            assert language in LANGUAGES and isinstance(code, str) and isinstance(stdin, str)
        except Exception:
            return self._send(400, {"error": "bad request"})
        if not slots.acquire(blocking=False):
            return self._send(429, {"error": "busy"})
        try:
            self._send(200, run_program(language, code, stdin))
        finally:
            slots.release()


def _consteq(a, b):
    import hmac
    return hmac.compare_digest(a.encode(), b.encode())


if __name__ == "__main__":
    if not TOKEN:
        sys.exit("SANDBOX_TOKEN must be set")
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
