"""Copies protocol events into SQLite so points and history do not need an archive node.
Safe to re-run: every event is stored once, keyed by block and log index."""
import json
import sqlite3


class Indexer:
    def __init__(self, db_path: str):
        self.db = sqlite3.connect(db_path, check_same_thread=False)
        self.db.execute(
            "CREATE TABLE IF NOT EXISTS events (block INTEGER, idx INTEGER, name TEXT, args TEXT, PRIMARY KEY (block, idx))"
        )
        self.db.execute("CREATE TABLE IF NOT EXISTS cursor (id INTEGER PRIMARY KEY CHECK (id = 1), block INTEGER)")
        self.db.commit()

    def cursor(self) -> int:
        row = self.db.execute("SELECT block FROM cursor WHERE id = 1").fetchone()
        return row[0] if row else -1

    def sync(self, chain) -> int:
        """Pull events from the last synced block up to the chain head. Returns how many were new."""
        start, head = self.cursor() + 1, chain.head()
        if start > head:
            return 0
        events = chain.events(start, head)
        before = self.db.total_changes
        for e in events:
            self.db.execute(
                "INSERT OR IGNORE INTO events VALUES (?, ?, ?, ?)",
                (e["block"], e["index"], e["name"], json.dumps(e["args"], default=str)),
            )
        added = self.db.total_changes - before
        self.db.execute("INSERT OR REPLACE INTO cursor VALUES (1, ?)", (head,))
        self.db.commit()
        return added

    def events(self) -> list[dict]:
        rows = self.db.execute("SELECT block, idx, name, args FROM events ORDER BY block, idx").fetchall()
        return [{"block": b, "index": i, "name": n, "args": _ints(json.loads(a))} for b, i, n, a in rows]


def _ints(args: dict) -> dict:
    """JSON turns big integers into strings on the way in; turn them back."""
    return {k: int(v) if isinstance(v, str) and v.isdigit() else v for k, v in args.items()}
