"""Adversarial tests for runner.py. Start the runner first:
   SANDBOX_TOKEN=secret python runner.py   (ideally as a non-root user)
   SANDBOX_TOKEN=secret python test_runner.py
"""
import json, os, sys, time, urllib.request, urllib.error

URL = os.environ.get("RUNNER_URL", "http://127.0.0.1:9000")
TOKEN = os.environ.get("SANDBOX_TOKEN", "secret")

def call(payload, token=TOKEN, timeout=30):
    req = urllib.request.Request(URL + "/run", data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json", "X-Sandbox-Token": token})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")

fails = []
def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (f"   [{detail}]" if detail and not cond else ""))
    if not cond: fails.append(name)

s, r = call({"language": "python", "code": "print(1+1)"})
check("normal python runs", s == 200 and r["stdout"].strip() == "2" and r["exit_code"] == 0)
s, r = call({"language": "c", "code": '#include <stdio.h>\nint main(void) { int n; if (scanf("%d", &n) != 1) return 1; printf("%d\\n", n * 2); return 0; }', "stdin": "21\n"})
check("normal C compiles and runs", s == 200 and r["stdout"].strip() == "42" and r["exit_code"] == 0, r)
s, r = call({"language": "cpp", "code": '#include <iostream>\nint main() { int n; if (!(std::cin >> n)) return 1; std::cout << n * 2 << "\\n"; }', "stdin": "21\n"})
check("normal C++ compiles and runs", s == 200 and r["stdout"].strip() == "42" and r["exit_code"] == 0, r)
s, r = call({"language": "java", "code": 'import java.util.Scanner;\npublic class Main { public static void main(String[] args) { Scanner input = new Scanner(System.in); System.out.println(input.nextInt() * 2); } }', "stdin": "21\n"})
check("normal Java compiles and runs", s == 200 and r["stdout"].strip() == "42" and r["exit_code"] == 0, r)
s, r = call({"language": "cpp", "code": "int main( {"})
check("compile errors are returned without running", s == 200 and r["exit_code"] != 0 and r["stderr"], r)
s, r = call({"language": "javascript", "code": "console.log(21*2)"})
check("normal javascript runs", s == 200 and r["stdout"].strip() == "42", r)
s, r = call({"language": "c", "code": '#include <stdio.h>\nint main(void) { int n; if (scanf("%d", &n) != 1) return 1; printf("%d\\n", n * 2); return 0; }', "stdin": "21\n"})
check("normal C compiles and runs", s == 200 and r["stdout"].strip() == "42" and r["exit_code"] == 0, r)
s, r = call({"language": "cpp", "code": '#include <iostream>\nint main() { int n; if (!(std::cin >> n)) return 1; std::cout << n * 2 << "\\n"; }', "stdin": "21\n"})
check("normal C++ compiles and runs", s == 200 and r["stdout"].strip() == "42" and r["exit_code"] == 0, r)
s, r = call({"language": "java", "code": 'import java.util.Scanner;\npublic class Main { public static void main(String[] args) { Scanner input = new Scanner(System.in); System.out.println(input.nextInt() * 2); } }', "stdin": "21\n"})
check("normal Java compiles and runs", s == 200 and r["stdout"].strip() == "42" and r["exit_code"] == 0, r)
s, r = call({"language": "cpp", "code": "int main( {"})
check("compile errors are returned without running", s == 200 and r["exit_code"] != 0 and r["stderr"], r)
s, r = call({"language": "python", "code": "print(input().upper())", "stdin": "hi\n"})
check("stdin works", r["stdout"].strip() == "HI")

t = time.time(); s, r = call({"language": "python", "code": "while True: pass"})
check("infinite loop is killed", r["timed_out"] or r.get("signal"), r); check("...within the wall limit", time.time() - t < 10, time.time() - t)
t = time.time(); s, r = call({"language": "python", "code": "import time; time.sleep(60)"})
check("sleep is killed by wall clock", r["timed_out"] is True and time.time() - t < 10)
s, r = call({"language": "javascript", "code": "while(true){}"})
check("js infinite loop killed", r["timed_out"] or r.get("signal"), r)

s, r = call({"language": "python", "code": "x = bytearray(2*1024**3); print('allocated')"})
check("python 2GB allocation refused", "allocated" not in r["stdout"] and r["exit_code"] != 0, r)

s, r = call({"language": "python", "code": "import sys\nwhile True: sys.stdout.write('A'*10000)"})
check("output flood is capped", s == 200 and len(r["stdout"]) <= 70000 and r["truncated"], len(r.get("stdout", "")))

s, r = call({"language": "python", "code": "import os\nprint([k for k in os.environ if 'SANDBOX' in k or 'TOKEN' in k or 'SECRET' in k])"})
check("secrets not in environment", r["stdout"].strip() == "[]", r["stdout"])
s, r = call({"language": "python", "code": "import os; print(os.getcwd()); print(os.listdir('.'))"})
check("cwd is a throwaway dir with only the program", "run_" in r["stdout"] and "main.py" in r["stdout"], r["stdout"])
s, r = call({"language": "python", "code": "open('big','wb').write(b'x'*(10*1024*1024))"})
check("large file writes are refused (RLIMIT_FSIZE)", r["exit_code"] != 0, r)

# fork bomb: only meaningful as a non-root user
code = "import os\nn=0\nfor _ in range(500):\n    try:\n        if os.fork()==0:\n            import time; time.sleep(3); os._exit(0)\n        n+=1\n    except OSError: break\nprint(n)"
s, r = call({"language": "python", "code": code})
n = int(r["stdout"].strip() or 0) if r["stdout"].strip().isdigit() else -1
if os.environ.get("RUNNER_IS_ROOT") == "1":
    print("SKIP fork-bomb limit (RLIMIT_NPROC does not bind root; run as non-root / rely on pids-limit)")
else:
    check("fork bomb bounded by RLIMIT_NPROC", 0 <= n < 200, n)
time.sleep(0.5)

s, r = call({"language": "python", "code": "print(1)"}, token="wrong")
check("wrong token rejected", s == 401); s, r = call({"language": "python", "code": "print(1)"}, token="")
check("missing token rejected", s == 401)
s, r = call({"language": "ruby", "code": "puts 1"}); check("unknown language rejected", s == 400)
s, r = call({"language": "python", "code": "x" * 70000}); check("oversized body rejected", s == 413)
s, r = call({"language": "python", "code": "raise SystemExit(3)"}); check("exit codes reported", r["exit_code"] == 3)
s, r = call({"language": "python", "code": "import sys; sys.stderr.write('boom'); sys.exit(1)"}); check("stderr captured", "boom" in r["stderr"])

print("\n%d failure(s)" % len(fails)); sys.exit(1 if fails else 0)
