"""Local dev server for the simulation API (Vercel doesn't run Python under `next dev`).

Serves the same engine on http://localhost:8000/api/simulate so the Next.js dev
server can proxy to it (see the rewrite in next.config.ts). Run:

    python3 scripts/dev_api.py
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "api"))
import _engine  # noqa: E402


def payload(method, query, body):
    params = {}
    if query:
        q = parse_qs(query)
        for k in ("a", "b", "nSims"):
            if k in q:
                params[k] = q[k][0]
        if "scenario" in q:
            try:
                params["scenario"] = json.loads(q["scenario"][0])
            except Exception:
                pass
    if method == "POST" and body:
        try:
            params.update(json.loads(body))
        except Exception:
            pass
    return _engine.serve(params)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, obj):
        b = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        if urlparse(self.path).path.rstrip("/").endswith("/api/simulate"):
            try:
                self._send(200, payload("GET", urlparse(self.path).query, None))
            except Exception as e:
                self._send(500, {"error": str(e)})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self):
        if urlparse(self.path).path.rstrip("/").endswith("/api/simulate"):
            n = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(n).decode() if n else None
            try:
                self._send(200, payload("POST", urlparse(self.path).query, body))
            except Exception as e:
                self._send(500, {"error": str(e)})
        else:
            self._send(404, {"error": "not found"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    print(f"sim dev API on http://localhost:{port}/api/simulate")
    ThreadingHTTPServer(("0.0.0.0", port), Handler).serve_forever()
