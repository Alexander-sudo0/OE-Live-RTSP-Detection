import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple


DB_LOCK = threading.Lock()


def get_db_path(repo_root: Path) -> Path:
    data = repo_root / 'data'
    data.mkdir(parents=True, exist_ok=True)
    return data / 'mizva.db'


def connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(str(db_path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    with conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS groups (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL UNIQUE,
              created_at INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS persons (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              name TEXT NOT NULL,
              group_id INTEGER,
              note TEXT,
              created_at INTEGER NOT NULL,
              FOREIGN KEY(group_id) REFERENCES groups(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS person_images (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              person_id INTEGER NOT NULL,
              filename TEXT NOT NULL,
              relpath TEXT NOT NULL,
              embedding TEXT NOT NULL,
              created_at INTEGER NOT NULL,
              FOREIGN KEY(person_id) REFERENCES persons(id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS cameras (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              url TEXT NOT NULL,
              transport TEXT NOT NULL,
              fps REAL NOT NULL,
              threshold REAL NOT NULL,
              mode TEXT NOT NULL,
              enabled INTEGER NOT NULL,
              created_at INTEGER NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              camera_id TEXT NOT NULL,
              ts INTEGER NOT NULL,
              confidence REAL NOT NULL,
              bbox TEXT NOT NULL,
              thumb_relpath TEXT,
              matched INTEGER NOT NULL,
              person_id INTEGER,
              person_name TEXT,
              extra TEXT,
              FOREIGN KEY(camera_id) REFERENCES cameras(id)
            )
            """
        )


def _now_ms() -> int:
    return int(time.time() * 1000)


def add_group(conn: sqlite3.Connection, name: str) -> int:
    with DB_LOCK, conn:
        cur = conn.execute("INSERT INTO groups(name, created_at) VALUES(?, ?)", (name, _now_ms()))
        lid = cur.lastrowid
        assert lid is not None
        return int(lid)


def list_groups(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    with DB_LOCK:
        rows = conn.execute("SELECT * FROM groups ORDER BY name").fetchall()
    return [dict(r) for r in rows]


def add_person(conn: sqlite3.Connection, name: str, group_id: Optional[int], note: Optional[str] = None) -> int:
    with DB_LOCK, conn:
        cur = conn.execute(
            "INSERT INTO persons(name, group_id, note, created_at) VALUES(?,?,?,?)",
            (name, group_id, note, _now_ms()),
        )
        lid = cur.lastrowid
        assert lid is not None
        return int(lid)


def add_person_image(conn: sqlite3.Connection, person_id: int, filename: str, relpath: str, embedding: List[float]) -> int:
    emb_json = json.dumps(embedding)
    with DB_LOCK, conn:
        cur = conn.execute(
            "INSERT INTO person_images(person_id, filename, relpath, embedding, created_at) VALUES(?,?,?,?,?)",
            (person_id, filename, relpath, emb_json, _now_ms()),
        )
        lid = cur.lastrowid
        assert lid is not None
        return int(lid)


def update_person(conn: sqlite3.Connection, person_id: int, name: str, group_id: Optional[int], note: Optional[str] = None) -> None:
    with DB_LOCK, conn:
        conn.execute(
            "UPDATE persons SET name=?, group_id=?, note=? WHERE id=?",
            (name, group_id, note, person_id),
        )


def delete_person(conn: sqlite3.Connection, person_id: int) -> None:
    with DB_LOCK, conn:
        # Delete person images first (foreign key constraint)
        conn.execute("DELETE FROM person_images WHERE person_id=?", (person_id,))
        # Delete the person
        conn.execute("DELETE FROM persons WHERE id=?", (person_id,))


def get_watchlist(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    with DB_LOCK:
        rows = conn.execute(
            """
            SELECT p.id as person_id, p.name as person_name, p.group_id, pi.embedding, pi.relpath
            FROM persons p
            JOIN person_images pi ON pi.person_id = p.id
            ORDER BY p.id
            """
        ).fetchall()
    out: Dict[int, Dict[str, Any]] = {}
    for r in rows:
        pid = int(r["person_id"])
        if pid not in out:
            out[pid] = {
                "person_id": pid,
                "person_name": r["person_name"],
                "group_id": r["group_id"],
                "embeddings": [],
                "images": [],
                "thumb_relpath": None,
            }
        # collect embedding
        try:
            vec = json.loads(r["embedding"])  # list[float]
            out[pid]["embeddings"].append(vec)
        except Exception:
            pass
        # collect image relpath
        rel = r["relpath"]
        if rel and rel not in out[pid]["images"]:
            out[pid]["images"].append(rel)
            # first image becomes thumb
            if not out[pid]["thumb_relpath"]:
                out[pid]["thumb_relpath"] = rel
    return list(out.values())


def upsert_camera(conn: sqlite3.Connection, cam: Dict[str, Any]) -> None:
    with DB_LOCK, conn:
        conn.execute(
            """
            INSERT INTO cameras(id, name, url, transport, fps, threshold, mode, enabled, created_at)
            VALUES(?,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET
              name=excluded.name,
              url=excluded.url,
              transport=excluded.transport,
              fps=excluded.fps,
              threshold=excluded.threshold,
              mode=excluded.mode,
              enabled=excluded.enabled
            """,
            (
                cam["id"], cam["name"], cam["url"], cam.get("transport", "tcp"), cam.get("fps", 3.0), cam.get("threshold", 0.6), cam.get("mode", "watchlist"), int(cam.get("enabled", 1)), _now_ms(),
            ),
        )


def list_cameras(conn: sqlite3.Connection) -> List[Dict[str, Any]]:
    with DB_LOCK:
        rows = conn.execute("SELECT * FROM cameras ORDER BY created_at DESC").fetchall()
    return [dict(r) for r in rows]


def remove_camera(conn: sqlite3.Connection, cam_id: str) -> None:
    with DB_LOCK, conn:
        conn.execute("DELETE FROM cameras WHERE id=?", (cam_id,))


def insert_event(conn: sqlite3.Connection, ev: Dict[str, Any]) -> int:
    with DB_LOCK, conn:
        cur = conn.execute(
            """
            INSERT INTO events(camera_id, ts, confidence, bbox, thumb_relpath, matched, person_id, person_name, extra)
            VALUES(?,?,?,?,?,?,?,?,?)
            """,
            (
                ev["camera_id"], int(ev["ts"]), float(ev["confidence"]), json.dumps(ev["bbox"]), ev.get("thumb_relpath"), int(bool(ev.get("matched", False))), ev.get("person_id"), ev.get("person_name"), json.dumps(ev.get("extra") or {}),
            ),
        )
        lid = cur.lastrowid
        assert lid is not None
        return int(lid)


def list_events(conn: sqlite3.Connection, limit: int = 100, matched: Optional[bool] = None) -> List[Dict[str, Any]]:
    with DB_LOCK:
        if matched is None:
            rows = conn.execute("SELECT * FROM events ORDER BY ts DESC LIMIT ?", (limit,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM events WHERE matched=? ORDER BY ts DESC LIMIT ?", (1 if matched else 0, limit)).fetchall()
    return [dict(r) for r in rows]
