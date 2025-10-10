import os
import json
import uuid
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
import threading
from werkzeug.utils import secure_filename

def _now_ms() -> int:
    return int(time.time() * 1000)

def _atomic_write_json(path: Path, data: Dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(path)

def _read_json(path: Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)

class LocalStore:
    def __init__(self, root: Optional[str] = None) -> None:
        base = Path(root) if root else Path(__file__).resolve().parents[1] / "data"
        self.root = base
        self.images = self.root / "images"
        self.videos = self.root / "videos"
        self.jobs = self.root / "jobs"
        for p in (self.images, self.videos, self.jobs):
            p.mkdir(parents=True, exist_ok=True)
        # Thread safety for job updates
        self._lock = threading.Lock()

    def save_upload(self, file_storage, kind: str) -> Dict[str, Any]:
        assert kind in ("image", "video")
        folder = self.images if kind == "image" else self.videos
        fname = secure_filename(file_storage.filename or f"upload-{uuid.uuid4().hex}")
        stem, ext = os.path.splitext(fname)
        new_name = f"{int(time.time())}-{uuid.uuid4().hex}{ext.lower() or '.bin'}"
        path = folder / new_name
        file_storage.stream.seek(0)
        file_storage.save(str(path))
        return {
            "kind": kind,
            "filename": new_name,
            "path": str(path),
            "relpath": str(path.relative_to(self.root)),
            "created_at": _now_ms(),
        }

    def new_job(self, job_type: str, payload: Dict[str, Any]) -> str:
        job_id = f"job-{uuid.uuid4().hex}"
        record = {
            "id": job_id,
            "type": job_type,
            "status": "queued",   # queued | running | done | error
            "progress": 0.0,
            "payload": payload,
            "result": None,
            "error": None,
            "created_at": _now_ms(),
            "updated_at": _now_ms(),
        }
        _atomic_write_json(self.jobs / f"{job_id}.json", record)
        return job_id

    def update_job(self, job_id: str, **fields) -> Dict[str, Any]:
        with self._lock:
            path = self.jobs / f"{job_id}.json"
            data = _read_json(path)
            data.update(fields)
            data["updated_at"] = _now_ms()
            _atomic_write_json(path, data)
            return data

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        path = self.jobs / f"{job_id}.json"
        if not path.exists():
            return None
        return _read_json(path)

    def list_uploads(self) -> Dict[str, List[Dict[str, Any]]]:
        def _ls(folder: Path, kind: str) -> List[Dict[str, Any]]:
            out: List[Dict[str, Any]] = []
            for p in sorted(folder.glob("*"), key=lambda x: x.stat().st_mtime, reverse=True):
                if p.is_file():
                    out.append({
                        "kind": kind,
                        "filename": p.name,
                        "relpath": str(p.relative_to(self.root)),
                        "size": p.stat().st_size,
                        "modified_at": int(p.stat().st_mtime * 1000),
                    })
            return out
        return {
            "images": _ls(self.images, "image"),
            "videos": _ls(self.videos, "video"),
        }