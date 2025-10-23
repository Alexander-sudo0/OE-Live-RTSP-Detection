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
              quality_score REAL DEFAULT 1.0,
              is_low_quality INTEGER DEFAULT 0,
              full_image_path TEXT,
              
              -- Enhanced metadata fields
              episode_id INTEGER,
              track_id TEXT,
              frame_number INTEGER,
              
              -- Face coordinates  
              face_left INTEGER,
              face_top INTEGER,
              face_right INTEGER,
              face_bottom INTEGER,
              
              -- Quality metrics
              face_width INTEGER,
              face_height INTEGER,
              face_size INTEGER,
              sharpness REAL,
              brightness REAL,
              
              -- Facial features (JSON stored as TEXT)
              age_estimate INTEGER,
              age_confidence REAL,
              gender TEXT, -- 'male', 'female'
              gender_confidence REAL,
              has_glasses INTEGER DEFAULT 0,
              glasses_confidence REAL,
              has_beard INTEGER DEFAULT 0,
              beard_confidence REAL,
              liveness_score REAL,
              emotions TEXT, -- JSON: {"happiness": 0.8, "surprise": 0.2}
              
              -- Recognition details
              similarity_score REAL,
              recognition_threshold REAL,
              detection_threshold REAL,
              
              -- Tracking info
              track_duration REAL,
              track_confidence REAL,
              is_new_track INTEGER DEFAULT 0,
              
              -- Event classification
              event_type TEXT, -- 'entry', 'exit', 'recognized', etc.
              alert_level TEXT, -- 'low', 'medium', 'high', 'critical' 
              is_blacklisted INTEGER DEFAULT 0,
              is_whitelisted INTEGER DEFAULT 0,
              
              -- Processing metadata
              processing_time_ms REAL,
              frame_fps REAL,
              model_version TEXT,
              
              -- External references
              external_ref_id TEXT,
              sync_status TEXT DEFAULT 'pending',
              
              FOREIGN KEY(camera_id) REFERENCES cameras(id)
            )
            """
        )
        
        # Add migration for quality fields if they don't exist
        try:
            conn.execute("ALTER TABLE events ADD COLUMN quality_score REAL DEFAULT 1.0")
        except sqlite3.OperationalError:
            pass  # Column already exists
            
        try:
            conn.execute("ALTER TABLE events ADD COLUMN is_low_quality INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass
            
        # Migrate enhanced metadata fields
        new_columns = [
            ("episode_id", "INTEGER"),
            ("track_id", "TEXT"),
            ("frame_number", "INTEGER"),
            ("face_left", "INTEGER"),
            ("face_top", "INTEGER"), 
            ("face_right", "INTEGER"),
            ("face_bottom", "INTEGER"),
            ("face_width", "INTEGER"),
            ("face_height", "INTEGER"),
            ("face_size", "INTEGER"),
            ("sharpness", "REAL"),
            ("brightness", "REAL"),
            ("age_estimate", "INTEGER"),
            ("age_confidence", "REAL"),
            ("gender", "TEXT"),
            ("gender_confidence", "REAL"),
            ("has_glasses", "INTEGER DEFAULT 0"),
            ("glasses_confidence", "REAL"),
            ("has_beard", "INTEGER DEFAULT 0"),
            ("beard_confidence", "REAL"),
            ("liveness_score", "REAL"),
            ("emotions", "TEXT"),
            ("similarity_score", "REAL"),
            ("recognition_threshold", "REAL"),
            ("detection_threshold", "REAL"),
            ("track_duration", "REAL"),
            ("track_confidence", "REAL"),
            ("is_new_track", "INTEGER DEFAULT 0"),
            ("event_type", "TEXT"),
            ("alert_level", "TEXT"),
            ("is_blacklisted", "INTEGER DEFAULT 0"),
            ("is_whitelisted", "INTEGER DEFAULT 0"),
            ("processing_time_ms", "REAL"),
            ("frame_fps", "REAL"),
            ("model_version", "TEXT"),
            ("external_ref_id", "TEXT"),
            ("sync_status", "TEXT DEFAULT 'pending'")
        ]
        
        for col_name, col_type in new_columns:
            try:
                conn.execute(f"ALTER TABLE events ADD COLUMN {col_name} {col_type}")
            except sqlite3.OperationalError:
                pass  # Column already exists
        
        try:
            conn.execute("ALTER TABLE events ADD COLUMN is_low_quality INTEGER DEFAULT 0")
        except sqlite3.OperationalError:
            pass  # Column already exists
            
        try:
            conn.execute("ALTER TABLE events ADD COLUMN full_image_path TEXT")
        except sqlite3.OperationalError:
            pass  # Column already exists


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
    """
    Insert enhanced face detection event with comprehensive metadata.
    
    Expected event structure (all optional except camera_id, ts, confidence, bbox):
    {
        'camera_id': str,
        'ts': int (timestamp),
        'confidence': float,
        'bbox': [x1, y1, x2, y2],
        'thumb_relpath': str,
        'matched': bool,
        'person_id': int,
        'person_name': str,
        
        # Enhanced metadata
        'episode_id': int,
        'track_id': str,
        'frame_number': int,
        'face_coordinates': {'left': int, 'top': int, 'right': int, 'bottom': int},
        'face_metrics': {'width': int, 'height': int, 'size': int, 'sharpness': float, 'brightness': float},
        'facial_features': {
            'age': {'estimate': int, 'confidence': float},
            'gender': {'name': str, 'confidence': float},
            'glasses': {'has_glasses': bool, 'confidence': float},
            'beard': {'has_beard': bool, 'confidence': float},
            'liveness': float,
            'emotions': dict
        },
        'recognition_details': {
            'similarity_score': float,
            'recognition_threshold': float, 
            'detection_threshold': float
        },
        'tracking': {
            'duration': float,
            'confidence': float,
            'is_new_track': bool
        },
        'classification': {
            'event_type': str,
            'alert_level': str,
            'is_blacklisted': bool,
            'is_whitelisted': bool
        },
        'processing': {
            'time_ms': float,
            'fps': float,
            'model_version': str
        }
    }
    """
    with DB_LOCK, conn:
        # Extract nested metadata with safe defaults
        face_coords = ev.get("face_coordinates", {})
        face_metrics = ev.get("face_metrics", {})
        facial_features = ev.get("facial_features", {})
        age_info = facial_features.get("age", {})
        gender_info = facial_features.get("gender", {})
        glasses_info = facial_features.get("glasses", {})
        beard_info = facial_features.get("beard", {})
        recognition = ev.get("recognition_details", {})
        tracking = ev.get("tracking", {})
        classification = ev.get("classification", {})
        processing = ev.get("processing", {})
        
        # Serialize complex fields as JSON
        emotions_json = json.dumps(facial_features.get("emotions", {}))
        extra_json = json.dumps(ev.get("extra", {}))
        
        cur = conn.execute(
            """
            INSERT INTO events(
                camera_id, ts, confidence, bbox, thumb_relpath, matched, person_id, person_name, extra, 
                quality_score, is_low_quality, full_image_path,
                episode_id, track_id, frame_number,
                face_left, face_top, face_right, face_bottom,
                face_width, face_height, face_size, sharpness, brightness,
                age_estimate, age_confidence, gender, gender_confidence,
                has_glasses, glasses_confidence, has_beard, beard_confidence, liveness_score, emotions,
                similarity_score, recognition_threshold, detection_threshold,
                track_duration, track_confidence, is_new_track,
                event_type, alert_level, is_blacklisted, is_whitelisted,
                processing_time_ms, frame_fps, model_version,
                external_ref_id, sync_status
            )
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                # Core event data
                ev["camera_id"], 
                int(ev["ts"]), 
                float(ev["confidence"]), 
                json.dumps(ev["bbox"]), 
                ev.get("thumb_relpath"), 
                int(bool(ev.get("matched", False))), 
                ev.get("person_id"), 
                ev.get("person_name"), 
                extra_json,
                float(ev.get("quality_score", 1.0)),
                int(bool(ev.get("is_low_quality", False))),
                ev.get("full_image_path"),
                
                # Enhanced metadata
                ev.get("episode_id"),
                ev.get("track_id"),
                ev.get("frame_number"),
                
                # Face coordinates
                face_coords.get("left"),
                face_coords.get("top"), 
                face_coords.get("right"),
                face_coords.get("bottom"),
                
                # Face metrics
                face_metrics.get("width"),
                face_metrics.get("height"),
                face_metrics.get("size"),
                face_metrics.get("sharpness"),
                face_metrics.get("brightness"),
                
                # Facial features
                age_info.get("estimate"),
                age_info.get("confidence"),
                gender_info.get("name"),
                gender_info.get("confidence"),
                int(bool(glasses_info.get("has_glasses", False))),
                glasses_info.get("confidence"),
                int(bool(beard_info.get("has_beard", False))),
                beard_info.get("confidence"),
                facial_features.get("liveness"),
                emotions_json,
                
                # Recognition details
                recognition.get("similarity_score"),
                recognition.get("recognition_threshold"),
                recognition.get("detection_threshold"),
                
                # Tracking info
                tracking.get("duration"),
                tracking.get("confidence"),
                int(bool(tracking.get("is_new_track", False))),
                
                # Classification
                classification.get("event_type"),
                classification.get("alert_level"),
                int(bool(classification.get("is_blacklisted", False))),
                int(bool(classification.get("is_whitelisted", False))),
                
                # Processing metadata
                processing.get("time_ms"),
                processing.get("fps"),
                processing.get("model_version"),
                
                # External integration
                ev.get("external_ref_id"),
                ev.get("sync_status", "pending")
            ),
        )
        lid = cur.lastrowid
        assert lid is not None
        return int(lid)


def list_events(conn: sqlite3.Connection, limit: int = 100, matched: Optional[bool] = None) -> List[Dict[str, Any]]:
    with DB_LOCK:
        if matched is None:
            rows = conn.execute(
                """
                SELECT e.*, c.name as camera_name 
                FROM events e 
                LEFT JOIN cameras c ON e.camera_id = c.id 
                ORDER BY e.ts DESC LIMIT ?
                """, 
                (limit,)
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT e.*, c.name as camera_name 
                FROM events e 
                LEFT JOIN cameras c ON e.camera_id = c.id 
                WHERE e.matched=? 
                ORDER BY e.ts DESC LIMIT ?
                """, 
                (1 if matched else 0, limit)
            ).fetchall()
    return [dict(r) for r in rows]
