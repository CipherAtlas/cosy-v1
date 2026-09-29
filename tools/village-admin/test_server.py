import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from server import AdminServer


SECRET = "test-secret-" + "x" * 40


class FakeWorker(BaseHTTPRequestHandler):
    entries = [{"messageId": "11111111-1111-1111-1111-111111111111", "name": "Cosy Otter", "message": "Hello"}]

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
        self.respond(200, {"chatHour": 100, "entries": self.entries})

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

    @classmethod
    def setUpClass(cls):
        cls.worker = ThreadingHTTPServer(("127.0.0.1", 0), FakeWorker)
        cls.admin = AdminServer(("127.0.0.1", 0), f"http://127.0.0.1:{cls.worker.server_port}", SECRET)
        cls.worker_thread = threading.Thread(target=cls.worker.serve_forever, daemon=True)
        cls.admin_thread = threading.Thread(target=cls.admin.serve_forever, daemon=True)
        cls.worker_thread.start()
        cls.admin_thread.start()
        cls.url = f"http://127.0.0.1:{cls.admin.server_port}"

    @classmethod
    def tearDownClass(cls):
        cls.admin.shutdown()
        cls.worker.shutdown()
        cls.admin.server_close()
        cls.worker.server_close()

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


if __name__ == "__main__":
    unittest.main()
