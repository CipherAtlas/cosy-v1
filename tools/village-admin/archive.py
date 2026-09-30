"""Private, seven-day SQLite archive for chat seen by the local admin server."""

import os
import re
import sqlite3
import time
from contextlib import closing
from pathlib import Path


RETENTION_SECONDS = 7 * 24 * 60 * 60
ARCHIVE_FILE = Path.home() / ".local" / "share" / "cosy-village" / "chat-archive.sqlite3"
MESSAGE_ID = re.compile(r"[0-9a-f-]{36}\Z")
DAY = re.compile(r"\d{4}-\d{2}-\d{2}\Z")


class ChatArchive:
    def __init__(self, path=ARCHIVE_FILE):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, mode=0o700, exist_ok=True)
        if self.path.parent.is_symlink() or self.path.parent.stat().st_mode & 0o077:
            raise ValueError("The archive directory must be private (mode 0700).")
        if self.path.is_symlink():
            raise ValueError("The archive file cannot be a symbolic link.")
        if not self.path.exists():
            try:
                os.close(os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600))
            except FileExistsError:
                pass
        if self.path.stat().st_mode & 0o077:
            raise ValueError("The archive file must be readable only by you (mode 0600).")
        with closing(self.connect()) as connection, connection:
            connection.execute("PRAGMA auto_vacuum=FULL")
            connection.execute("""
                CREATE TABLE IF NOT EXISTS messages (
                    message_id TEXT PRIMARY KEY,
                    chat_hour INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    message TEXT NOT NULL,
                    first_seen_at INTEGER NOT NULL
                )
            """)
            connection.execute("CREATE INDEX IF NOT EXISTS messages_seen ON messages(first_seen_at DESC)")
        self.prune()

    def connect(self):
        connection = sqlite3.connect(self.path, timeout=5)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA secure_delete=ON")
        return connection

    def prune(self, now=None):
        cutoff = int(time.time() if now is None else now) - RETENTION_SECONDS
        with closing(self.connect()) as connection, connection:
            connection.execute("DELETE FROM messages WHERE first_seen_at < ?", (cutoff,))

    def capture(self, chat, now=None):
        observed_at = int(time.time() if now is None else now)
        hour = chat.get("chatHour") if isinstance(chat, dict) else None
        entries = chat.get("entries") if isinstance(chat, dict) else None
        if type(hour) is not int or not isinstance(entries, list):
            raise ValueError("The Worker returned an invalid chat snapshot.")
        rows = []
        for entry in entries:
            if not isinstance(entry, dict):
                continue
            message_id, name, message = (entry.get(key) for key in ("messageId", "name", "message"))
            if isinstance(message_id, str) and MESSAGE_ID.fullmatch(message_id) and isinstance(name, str) and isinstance(message, str):
                rows.append((message_id, hour, name, message, observed_at))
        with closing(self.connect()) as connection, connection:
            connection.execute("DELETE FROM messages WHERE first_seen_at < ?", (observed_at - RETENTION_SECONDS,))
            connection.executemany(
                "INSERT OR IGNORE INTO messages (message_id, chat_hour, name, message, first_seen_at) VALUES (?, ?, ?, ?, ?)",
                rows,
            )

    def list_messages(self, query="", day="", offset=0, now=None):
        if len(query) > 100 or (day and not DAY.fullmatch(day)) or offset < 0:
            raise ValueError("Invalid archive filter.")
        self.prune(now)
        clauses = []
        parameters = []
        if query:
            escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            clauses.append("(name LIKE ? ESCAPE '\\' OR message LIKE ? ESCAPE '\\')")
            parameters.extend((f"%{escaped}%", f"%{escaped}%"))
        if day:
            clauses.append("date(first_seen_at, 'unixepoch', 'localtime') = ?")
            parameters.append(day)
        where = " WHERE " + " AND ".join(clauses) if clauses else ""
        with closing(self.connect()) as connection:
            total_archived = connection.execute("SELECT COUNT(*) FROM messages").fetchone()[0]
            total = connection.execute("SELECT COUNT(*) FROM messages" + where, parameters).fetchone()[0]
            days = [dict(row) for row in connection.execute("""
                SELECT date(first_seen_at, 'unixepoch', 'localtime') AS day, COUNT(*) AS count
                FROM messages GROUP BY day ORDER BY day DESC
            """)]
            items = [dict(row) for row in connection.execute(
                "SELECT message_id AS messageId, name, message, first_seen_at AS firstSeenAt "
                "FROM messages" + where + " ORDER BY first_seen_at DESC, rowid DESC LIMIT 80 OFFSET ?",
                (*parameters, offset),
            )]
        return {"items": items, "total": total, "totalArchived": total_archived, "days": days}
