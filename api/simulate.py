"""Vercel Python serverless function: POST/GET /api/simulate.

Thin wrapper around the shared engine. Accepts:
  GET  /api/simulate?a=Canada&b=Portugal
  POST /api/simulate   {"a","b","scenario":{...},"nSims":24000}
Returns the aggregated probability JSON.
"""
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _engine  # noqa: E402


def _payload(method, raw_query, raw_body):
    params = {}
    if raw_query:
        q = parse_qs(raw_query)
        for k in ("a", "b", "nSims"):
            if k in q:
                params[k] = q[k][0]
        if "scenario" in q:
            try:
                params["scenario"] = json.loads(q["scenario"][0])
            except Exception:
                pass
    if method == "POST" and raw_body:
        try:
            params.update(json.loads(raw_body))
        except Exception:
            pass
    return _engine.serve(params)


class handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "public, max-age=120, s-maxage=300")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self._send(204, {})

    def do_GET(self):
        try:
            self._send(200, _payload("GET", urlparse(self.path).query, None))
        except Exception as e:  # never 500 silently
            self._send(500, {"error": str(e)})

    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length") or 0)
            body = self.rfile.read(length).decode("utf-8") if length else None
            self._send(200, _payload("POST", urlparse(self.path).query, body))
        except Exception as e:
            self._send(500, {"error": str(e)})
