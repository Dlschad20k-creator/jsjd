"""GitHub-API-Simulator für Tests des Daten-Syncs (Contents-API, Workflow-Dispatch).

Start: python3 tests/mock_github.py 8600   – akzeptiert nur den Token "test-token".
"""
import base64
import hashlib
import json
import sys
import urllib.parse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

FILES = {}       # (repo, path) -> (bytes, sha)
COMMITS = []     # Liste von (repo, path, message)
DISPATCHES = []  # Liste von (repo, workflow, body)
REPOS = {"Dlschad20k-creator/aura-kino-daten", "Dlschad20k-creator/jsjd"}


class H(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, status, obj=None, raw=None, ctype="application/json"):
        body = raw if raw is not None else json.dumps(obj or {}).encode()
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type, Accept, X-GitHub-Api-Version")
        self.send_header("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, raw=b"")

    def _auth(self):
        return self.headers.get("Authorization") == "Bearer test-token"

    def do_GET(self):
        u = urllib.parse.urlparse(self.path)
        p = u.path.split("/")
        if u.path == "/_state":
            return self._send(200, {"files": {f"{k[0]}:{k[1]}": json.loads(v[0]) for k, v in FILES.items()},
                                    "commits": COMMITS, "dispatches": DISPATCHES})
        if len(p) >= 4 and p[1] == "repos":
            repo = f"{p[2]}/{p[3]}"
            if len(p) == 4:
                return self._send(200, {"full_name": repo, "private": True}) if repo in REPOS and self._auth() else self._send(404, {"message": "Not Found"})
            if p[4] == "actions":
                return self._send(200, {"workflow_runs": [{"status": "completed", "conclusion": "success", "html_url": "https://github.com/x",
                                                           "run_started_at": "2026-11-21T03:07:00Z", "event": "schedule"}]})
            if p[4] == "contents":
                if not self._auth():
                    return self._send(401, {"message": "Bad credentials"})
                path = "/".join(p[5:])
                if (repo, path) not in FILES:
                    return self._send(404, {"message": "Not Found"})
                data, sha = FILES[(repo, path)]
                if "raw" in (self.headers.get("Accept") or ""):
                    return self._send(200, raw=data, ctype="application/octet-stream")
                b64 = base64.encodebytes(data).decode()  # mit Zeilenumbrüchen wie GitHub
                return self._send(200, {"sha": sha, "content": b64 if len(data) < 1_000_000 else "", "encoding": "base64"})
        self._send(404, {"message": "Not Found"})

    def do_PUT(self):
        u = urllib.parse.urlparse(self.path)
        p = u.path.split("/")
        if not self._auth():
            return self._send(401, {"message": "Bad credentials"})
        repo, path = f"{p[2]}/{p[3]}", "/".join(p[5:])
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)))
        cur = FILES.get((repo, path))
        if cur and body.get("sha") != cur[1]:
            return self._send(409, {"message": "sha mismatch"})
        if not cur and body.get("sha"):
            return self._send(422, {"message": "sha given for new file"})
        data = base64.b64decode(body["content"])
        sha = hashlib.sha1(data).hexdigest()
        FILES[(repo, path)] = (data, sha)
        COMMITS.append((repo, path, body.get("message")))
        self._send(201 if not cur else 200, {"content": {"sha": sha}})

    def do_POST(self):
        u = urllib.parse.urlparse(self.path)
        p = u.path.split("/")
        if not self._auth():
            return self._send(401, {"message": "Bad credentials"})
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length") or 0)) or b"{}")
        if len(p) > 7 and p[4] == "actions" and p[7] == "dispatches":
            DISPATCHES.append((f"{p[2]}/{p[3]}", p[6], body))
            return self._send(204, raw=b"")
        self._send(404, {"message": "Not Found"})


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8600
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
