import os
import tempfile
import unittest
from datetime import datetime
from pathlib import Path

from archive import RETENTION_SECONDS, ChatArchive


class ChatArchiveTest(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.path = Path(self.temp_dir.name) / "private" / "chat.sqlite3"
        self.archive = ChatArchive(self.path)
        self.now = 1_800_000_000
        self.chat = {"chatHour": self.now // 3600, "entries": [
            {"messageId": "11111111-1111-1111-1111-111111111111", "name": "Cosy Otter", "message": "A quiet hello"},
            {"messageId": "22222222-2222-2222-2222-222222222222", "name": "Mossy Fox", "message": "Mint % tea"},
        ]}

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_private_capture_deduplication_search_and_retention(self):
        self.assertEqual(os.stat(self.path.parent).st_mode & 0o777, 0o700)
        self.assertEqual(os.stat(self.path).st_mode & 0o777, 0o600)
        self.archive.capture(self.chat, self.now)
        self.archive.capture(self.chat, self.now + 30)
        self.archive = ChatArchive(self.path)
        all_messages = self.archive.list_messages(now=self.now + 30)
        self.assertEqual(all_messages["totalArchived"], 2)
        self.assertEqual(all_messages["items"][0]["firstSeenAt"], self.now)
        self.assertEqual(self.archive.list_messages("Mint %", now=self.now)["total"], 1)
        day = datetime.fromtimestamp(self.now).strftime("%Y-%m-%d")
        self.assertEqual(self.archive.list_messages(day=day, now=self.now)["total"], 2)
        self.assertEqual(self.archive.list_messages(day="2000-01-01", now=self.now)["total"], 0)
        self.assertEqual(self.archive.list_messages(now=self.now + RETENTION_SECONDS)["totalArchived"], 2)
        self.assertEqual(self.archive.list_messages(now=self.now + RETENTION_SECONDS + 1)["totalArchived"], 0)

    def test_invalid_snapshot_and_public_archive_permissions(self):
        with self.assertRaises(ValueError):
            self.archive.capture({"chatHour": 1, "entries": "invalid"})
        self.path.chmod(0o644)
        with self.assertRaisesRegex(ValueError, "mode 0600"):
            ChatArchive(self.path)


if __name__ == "__main__":
    unittest.main()
