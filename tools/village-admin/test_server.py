import json
import tempfile
import threading
import time
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from server import AdminServer


SECRET = "test-secret-" + "x" * 40


class FakeWorker(BaseHTTPRequestHandler):
    entries = [{"messageId": "11111111-1111-1111-1111-111111111111", "name": "Cosy Otter", "message": "Hello"}]
    players = [{"id": "22222222-2222-2222-2222-222222222222", "name": "Cosy Otter", "color": "#dddddd", "canKick": True}]

    def respond(self, status, payload):
        body = json.dumps(payload).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def authorized(self):
        if self.headers.get("Authorization") != f"Bearer {SECRET}":
            self.respond(401, {"error": "Unauthorized"})
            return False
        return True

    def do_GET(self):
        if not self.authorized():
            return
        if self.path == "/admin/players":
            return self.respond(200, {"players": self.players})
        self.respond(200, {"chatHour": 100, "entries": self.entries})

    def do_POST(self):
        if not self.authorized():
            return
        if self.path != "/admin/players/22222222-2222-2222-2222-222222222222/kick" or not self.players:
            return self.respond(404, {"error": "Player left"})
        type(self).players = []
        self.respond(200, {"players": [], "until": int(time.time() * 1000) + 300000, "kickedCount": 1})

    def do_DELETE(self):
        if not self.authorized():
            return
        if self.path == "/admin/chat" and self.headers.get("If-Match") == '"100"':
            type(self).entries = []
        elif self.path.endswith("11111111-1111-1111-1111-111111111111"):
            type(self).entries = []
        else:
            return self.respond(409, {"error": "Changed"})
        self.respond(200, {"chatHour": 100, "entries": self.entries})

    def log_message(self, *args):
        pass


class AdminServerTest(unittest.TestCase):
    def setUp(self):
        FakeWorker.entries = [{"messageId": "11111111-1111-1111-1111-111111111111", "name": "Cosy Otter", "message": "Hello"}]
        FakeWorker.players = [{"id": "22222222-2222-2222-2222-222222222222", "name": "Cosy Otter", "color": "#dddddd", "canKick": True}]

    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.TemporaryDirectory()
        cls.worker = ThreadingHTTPServer(("127.0.0.1", 0), FakeWorker)
        cls.admin = AdminServer(
            ("127.0.0.1", 0), f"http://127.0.0.1:{cls.worker.server_port}", SECRET,
            archive_path=Path(cls.temp_dir.name) / "private" / "chat.sqlite3", poll_interval=0.1,
        )
        cls.worker_thread = threading.Thread(target=cls.worker.serve_forever, daemon=True)
        cls.admin_thread = threading.Thread(target=cls.admin.serve_forever, daemon=True)
        cls.worker_thread.start()
        cls.admin.start_archiving()
        cls.admin_thread.start()
        cls.url = f"http://127.0.0.1:{cls.admin.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.admin.shutdown()
        cls.admin.server_close()
        cls.worker.shutdown()
        cls.worker.server_close()
        cls.temp_dir.cleanup()

    def test_background_capture_without_browser_page(self):
        deadline = time.monotonic() + 2
        while self.admin.last_capture_at is None and time.monotonic() < deadline:
            time.sleep(0.02)
        self.assertIsNotNone(self.admin.last_capture_at)
        with urlopen(self.url + "/api/archive") as response:
            archive = json.load(response)
        self.assertGreaterEqual(archive["totalArchived"], 1)
        self.assertEqual(archive["items"][0]["message"], "Hello")

    def test_local_page_and_secret_boundary(self):
        with urlopen(self.url + "/") as response:
            page = response.read().decode()
            self.assertNotIn(SECRET, page)
            self.assertIn("frame-ancestors 'none'", response.headers["Content-Security-Policy"])
        with urlopen(self.url + "/api/chat") as response:
            self.assertEqual(json.load(response)["entries"][0]["message"], "Hello")

    def test_delete_requires_local_origin_and_session(self):
        data = json.dumps({"messageId": FakeWorker.entries[0]["messageId"]}).encode()
        headers = {"Content-Type": "application/json", "Origin": self.url}
        with self.assertRaises(HTTPError) as denied:
            urlopen(Request(self.url + "/api/delete", data=data, headers=headers))
        self.assertEqual(denied.exception.code, 403)
        denied.exception.close()
        headers["X-Admin-Session"] = self.admin.csrf_token
        with urlopen(Request(self.url + "/api/delete", data=data, headers=headers)) as response:
            self.assertEqual(json.load(response)["entries"], [])
        with urlopen(self.url + "/api/archive") as response:
            archive = json.load(response)
        self.assertEqual(archive["items"][0]["message"], "Hello")
        self.assertNotIn(SECRET, json.dumps(archive))

    def test_clear_preserves_local_archive(self):
        headers = {"Content-Type": "application/json", "Origin": self.url, "X-Admin-Session": self.admin.csrf_token}
        data = json.dumps({"chatHour": 100}).encode()
        with urlopen(Request(self.url + "/api/clear", data=data, headers=headers)) as response:
            self.assertEqual(json.load(response)["entries"], [])
        with urlopen(self.url + "/api/archive") as response:
            archive = json.load(response)
        self.assertEqual(archive["items"][0]["message"], "Hello")

    def test_players_and_kick_require_local_origin_and_session(self):
        with urlopen(self.url + "/api/players") as response:
            players = json.load(response)["players"]
        self.assertEqual(players[0]["name"], "Cosy Otter")
        self.assertNotIn(SECRET, json.dumps(players))
        data = json.dumps({"playerId": players[0]["id"]}).encode()
        headers = {"Content-Type": "application/json", "Origin": self.url}
        for supplied in [headers, {**headers, "Origin": "https://foreign.example", "X-Admin-Session": self.admin.csrf_token}]:
            with self.assertRaises(HTTPError) as denied:
                urlopen(Request(self.url + "/api/kick", data=data, headers=supplied))
            self.assertEqual(denied.exception.code, 403)
            denied.exception.close()
        headers["X-Admin-Session"] = self.admin.csrf_token
        with urlopen(Request(self.url + "/api/kick", data=data, headers=headers)) as response:
            self.assertEqual(json.load(response)["kickedCount"], 1)
        self.assertEqual(len(FakeWorker.entries), 1, "kicks preserve chat")
        with self.assertRaises(HTTPError) as stale:
            urlopen(Request(self.url + "/api/kick", data=data, headers=headers))
        self.assertEqual(stale.exception.code, 404)
        self.assertIn("player is no longer connected", json.loads(stale.exception.read())["error"])
        stale.exception.close()
        invalid = json.dumps({"playerId": "../../chat"}).encode()
        with self.assertRaises(HTTPError) as malformed:
            urlopen(Request(self.url + "/api/kick", data=invalid, headers=headers))
        self.assertEqual(malformed.exception.code, 400)
        malformed.exception.close()


if __name__ == "__main__":
    unittest.main()
