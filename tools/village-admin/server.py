"""Loopback-only proxy for the live village chat moderation API."""

import argparse
import getpass
import json
import re
import secrets
from http.client import HTTPConnection, HTTPSConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).parent
DEFAULT_WORKER = "https://cosy-village-world.sabargulati777.workers.dev"
TOKEN_FILE = Path.home() / ".config" / "cosy-village" / "chat-admin-token"
MESSAGE_ID = re.compile(r"[0-9a-f-]{36}\Z")


class AdminServer(ThreadingHTTPServer):
    def __init__(self, address, worker_url, token):
        super().__init__(address, AdminHandler)
        self.worker_url = worker_url.rstrip("/")
        self.token = token
        self.csrf_token = secrets.token_urlsafe(32)


class AdminHandler(BaseHTTPRequestHandler):
    def send_content(self, status, body, content_type):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.end_headers()
        self.wfile.write(body)

    def send_json(self, status, value):
        self.send_content(status, json.dumps(value).encode(), "application/json; charset=utf-8")

    def allowed_host(self):
        return self.headers.get("Host") == f"127.0.0.1:{self.server.server_port}"

    def upstream(self, method, path, extra_headers=None):
        headers = {
            "Authorization": f"Bearer {self.server.token}",
            "Accept": "application/json",
            "Cache-Control": "no-store",
        }
        headers.update(extra_headers or {})
        parsed = urlparse(self.server.worker_url)
        connection_type = HTTPSConnection if parsed.scheme == "https" else HTTPConnection
        connection = connection_type(parsed.hostname, parsed.port, timeout=8)
        try:
            connection.request(method, path, headers=headers)
            response = connection.getresponse()
            body = response.read(1_000_001)
            if len(body) > 1_000_000:
                return 502, {"error": "The server response was too large."}
            if 200 <= response.status < 300:
                return response.status, json.loads(body)
            if response.status == 404 and method == "GET" and path == "/admin/chat":
                return 404, {"error": "The admin API is not available on this Worker yet."}
            return response.status, {"error": {
                401: "The server rejected the admin secret.",
                404: "That message is no longer in the chat.",
                409: "The chat hour changed. Refresh before clearing it.",
            }.get(response.status, "The server could not complete this action.")}
        except (OSError, TimeoutError, ValueError):
            return 502, {"error": "Could not reach the village server."}
        finally:
            connection.close()

    def do_GET(self):
        if not self.allowed_host():
            return self.send_json(403, {"error": "Forbidden host."})
        if self.path == "/api/session":
            return self.send_json(200, {"csrfToken": self.server.csrf_token, "server": urlparse(self.server.worker_url).hostname})
        if self.path == "/api/chat":
            status, body = self.upstream("GET", "/admin/chat")
            return self.send_json(status, body)
        files = {"/": ("index.html", "text/html; charset=utf-8"),
                 "/admin.js": ("admin.js", "text/javascript; charset=utf-8"),
                 "/admin.css": ("admin.css", "text/css; charset=utf-8")}
        if self.path not in files:
            return self.send_json(404, {"error": "Not found."})
        name, content_type = files[self.path]
        return self.send_content(200, (ROOT / name).read_bytes(), content_type)

    def do_POST(self):
        if not self.allowed_host() or self.headers.get("Origin") != f"http://127.0.0.1:{self.server.server_port}":
            return self.send_json(403, {"error": "Forbidden origin."})
        if self.headers.get("X-Admin-Session") != self.server.csrf_token:
            return self.send_json(403, {"error": "Invalid local session."})
        if self.headers.get("Content-Type") != "application/json":
            return self.send_json(415, {"error": "JSON required."})
        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            return self.send_json(400, {"error": "Invalid request."})
        if length < 1 or length > 256:
            return self.send_json(400, {"error": "Invalid request."})
        try:
            payload = json.loads(self.rfile.read(length))
        except (ValueError, UnicodeDecodeError):
            return self.send_json(400, {"error": "Invalid JSON."})
        if self.path == "/api/delete" and isinstance(payload, dict) and isinstance(payload.get("messageId"), str) and MESSAGE_ID.fullmatch(payload["messageId"]):
            status, body = self.upstream("DELETE", "/admin/chat/" + payload["messageId"])
            return self.send_json(status, body)
        if self.path == "/api/clear" and isinstance(payload, dict) and type(payload.get("chatHour")) is int:
            status, body = self.upstream("DELETE", "/admin/chat", {"If-Match": f'"{payload["chatHour"]}"'})
            return self.send_json(status, body)
        return self.send_json(400, {"error": "Invalid action."})

    def log_message(self, format_string, *args):
        if len(args) > 1 and str(args[1]) != "200":
            super().log_message(format_string, *args)


def main():
    parser = argparse.ArgumentParser(description="Start the local village chat admin page")
    parser.add_argument("--port", type=int, default=3052)
    parser.add_argument("--worker-url", default=DEFAULT_WORKER)
    args = parser.parse_args()
    parsed = urlparse(args.worker_url)
    if not parsed.hostname:
        parser.error("Give a valid Worker origin.")
    if parsed.scheme != "https" and not (parsed.scheme == "http" and parsed.hostname in ("127.0.0.1", "localhost")):
        parser.error("The Worker URL must use HTTPS, except for a loopback test server.")
    if parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        parser.error("Give only the Worker origin, without credentials or a path.")
    if TOKEN_FILE.exists():
        if TOKEN_FILE.stat().st_mode & 0o077:
            parser.error("The local admin secret file must be readable only by you (mode 0600).")
        token = TOKEN_FILE.read_text().strip()
    else:
        token = getpass.getpass("Village admin secret: ")
    if len(token) < 32:
        parser.error("The admin secret must be at least 32 characters.")
    server = AdminServer(("127.0.0.1", args.port), args.worker_url, token)
    print(f"Village chat admin: http://127.0.0.1:{server.server_port}/")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
