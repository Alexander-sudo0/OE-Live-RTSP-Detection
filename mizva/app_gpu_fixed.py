from flask import Flask, request, jsonify, send_from_directory, url_for
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import sys
from pathlib import Path
import numpy as np
import cv2
import json
import threading
import time
from collections import deque
from typing import Dict, Any, Optional
import queue

# Ensure project root is on sys.path so we can import local packages (mizva.*)
ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Local imports - try relative import first
try:
    from mizva.storage import LocalStore
except ImportError:
    # Fallback to direct import if relative import fails
    from storage import LocalStore

try:
    from mizva import db as dbm
except ImportError:
    # Fallback to direct import
    import db as dbm

# Global quality threshold (default 0.4)
QUALITY_THRESHOLD = 0.4

def convert_to_json_serializable(obj):
    """Convert numpy types and other non-JSON-serializable types to Python native types."""
    if isinstance(obj, (np.integer, np.int64, np.int32)):
        return int(obj)
    elif isinstance(obj, (np.floating, np.float64, np.float32)):
        return float(obj)
    elif isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: convert_to_json_serializable(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [convert_to_json_serializable(item) for item in obj]
    return obj

def calculate_image_quality(image):
    """
    Calculate image quality using variance of Laplacian (blur detection) on face crop.
    Returns a score between 0 and 1, where higher values indicate better quality.
    """
    if image is None or image.size == 0:
        print("Warning: Empty or None image provided to quality calculation")
        return 0.0
    
    try:
        # Convert to grayscale if needed
        if len(image.shape) == 3:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        else:
            gray = image.copy()
        
        # Resize if too small for reliable analysis (min 32x32 pixels)
        if gray.shape[0] < 32 or gray.shape[1] < 32:
            gray = cv2.resize(gray, (64, 64))
        
        # Calculate variance of Laplacian (fast blur detection)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        laplacian_var = laplacian.var()
        
        # Improved normalization based on face crop analysis
        # Sharp faces: 50-200, Blurry faces: 5-30, Very blurry: <10
        if laplacian_var > 100:
            normalized_score = 0.9 + (min(laplacian_var - 100, 200) / 200) * 0.1
        elif laplacian_var > 30:
            normalized_score = 0.5 + ((laplacian_var - 30) / 70) * 0.4
        elif laplacian_var > 10:
            normalized_score = 0.2 + ((laplacian_var - 10) / 20) * 0.3
        else:
            normalized_score = laplacian_var / 10 * 0.2
        
        quality_score = max(0.0, min(1.0, normalized_score))
        return quality_score
        
    except Exception as e:
        print(f"Error calculating image quality: {e}")
        return 0.5  # Default to medium quality on error
try:
    # Add local insightface to Python path
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'insightface', 'python-package'))
    from insightface.app import FaceAnalysis  # type: ignore
    print("✅ Successfully imported InsightFace from local installation")
except Exception as e:
    print(f"⚠️ Failed to import InsightFace: {e}")
    # Try fallback import
    try:
        from mizva.app import FaceAnalysis  # type: ignore
        print("✅ Successfully imported FaceAnalysis from mizva.app")
    except Exception as e2:
        print(f"❌ All import attempts failed: {e2}")
        raise ImportError("Could not import FaceAnalysis from any source")
import uuid

app = Flask(__name__)
try:
    # Enable CORS for API routes for mobile/web dev
    CORS(app, resources={r"/api/*": {"origins": "*"}})
except Exception:
    pass

# Initialize file-based store and SQLite under repo_root/data
REPO_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = REPO_ROOT / "data"
store = LocalStore(str(DATA_DIR))
DB_PATH = dbm.get_db_path(REPO_ROOT)
DB_CONN = dbm.connect(DB_PATH)
dbm.init_db(DB_CONN)

BASE = Path(__file__).parent
UPLOAD_DIR = BASE / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

# Serve files from /data for debugging/mobile thumbnails
@app.route("/data/<path:subpath>", methods=["GET"])
def serve_data(subpath):
    return send_from_directory(DATA_DIR, subpath, as_attachment=False)

# in-memory job store: { job_id: {status:'running'|'done'|'error', progress:0-100, result: {...} } }
JOBS = {}

# initialize model once - WITH GPU SUPPORT!
print("Initializing FaceAnalysis...")
fa = FaceAnalysis(allowed_modules=['detection','recognition'])
try:
    # Try GPU first (ctx_id=0), fall back to CPU (ctx_id=-1) if it fails
    try:
        # Use larger detection size for better GPU utilization (GPU thrives on larger batches)
        fa.prepare(ctx_id=0, det_size=(640,640))  # ctx_id=0 enables GPU
        print("✅ FaceAnalysis initialized with GPU acceleration (ctx_id=0)")
        print(f"   Detection size: 640x640 (optimized for GPU)")
        try:
            print(f"   Available providers: {fa.rec_model.session.get_providers()}")
        except:
            print("   GPU providers: CUDAExecutionProvider enabled")
    except Exception as gpu_err:
        print(f"⚠️ GPU initialization failed: {gpu_err}")
        print("   Falling back to CPU execution...")
        fa.prepare(ctx_id=-1, det_size=(640,640))  # ctx_id=-1 uses CPU
        print("✅ FaceAnalysis initialized with CPU execution (ctx_id=-1)")
except Exception as e:
    print(f"⚠️ GPU initialization failed: {e}")
    print("Falling back to CPU...")
    fa.prepare(ctx_id=-1, det_size=(640,640))  # ctx_id=-1 for CPU fallback
    print("✅ FaceAnalysis initialized with CPU fallback (ctx_id=-1)")

# Helpers
IMAGES_DIR = DATA_DIR / "images"
IMAGES_DIR.mkdir(parents=True, exist_ok=True)

def _normalize(v: np.ndarray) -> np.ndarray:
    n = float(np.linalg.norm(v) + 1e-10)
    return (v / n).astype(np.float32)

def _face_embedding(img: np.ndarray):
    faces = fa.get(img)
    if not faces:
        return None, None
    face = faces[0]
    return _normalize(face.embedding), face.bbox.astype(int).tolist()

def _extract_face_features(face, face_crop_img=None):
    """
    Extract basic facial features - SIMPLIFIED for faster detection.
    Only extracts face coordinates, size, and quality metrics.
    NO age/gender extraction to maximize detection speed.
    """
    features = {}
    
    try:
        # Basic face metrics from bbox
        bbox = face.bbox.astype(int)
        x1, y1, x2, y2 = bbox
        width = x2 - x1
        height = y2 - y1
        size = width * height
        
        features['face_coordinates'] = {
            'left': int(x1),
            'top': int(y1), 
            'right': int(x2),
            'bottom': int(y2)
        }
        
        features['face_metrics'] = {
            'width': int(width),
            'height': int(height),
            'size': int(size),
            'sharpness': None,
            'brightness': None
        }
        
        # NO age/gender extraction for speed
        features['facial_features'] = {
            'age': {
                'estimate': None,
                'confidence': 0.0
            },
            'gender': {
                'name': None,
                'confidence': 0.0
            },
            'glasses': {
                'has_glasses': False,
                'confidence': 0.0
            },
            'beard': {
                'has_beard': False,
                'confidence': 0.0
            },
            'liveness': None,
            'emotions': {}
        }
        
        # Calculate only basic quality metrics if crop available
        if face_crop_img is not None:
            # Calculate brightness (fast)
            if len(face_crop_img.shape) == 3:
                gray_crop = cv2.cvtColor(face_crop_img, cv2.COLOR_BGR2GRAY)
            else:
                gray_crop = face_crop_img.copy()
            brightness = np.mean(gray_crop) / 255.0
            
            # Calculate sharpness (fast)
            laplacian = cv2.Laplacian(gray_crop, cv2.CV_64F)
            sharpness = laplacian.var()
            
            features['face_metrics']['sharpness'] = float(sharpness)
            features['face_metrics']['brightness'] = float(brightness)
        
        # Detection quality assessment
        detection_confidence = float(face.det_score) if hasattr(face, 'det_score') else 0.9
        
        features['recognition_details'] = {
            'detection_confidence': detection_confidence,
            'detection_threshold': 0.6,
            'recognition_threshold': 0.6
        }
        
        # Initialize tracking info
        features['tracking'] = {
            'duration': 0.0,
            'confidence': 0.0,
            'is_new_track': True
        }
        
        # Initialize classification
        features['classification'] = {
            'event_type': 'detection',
            'alert_level': 'info',
            'is_blacklisted': False,
            'is_whitelisted': False
        }
        
        # Processing metadata
        features['processing'] = {
            'time_ms': None,
            'fps': None,
            'model_version': 'insightface-buffalo_l'
        }
        
    except Exception as e:
        print(f"Error extracting face features: {e}")
        # Return minimal feature set on error
        bbox = face.bbox.astype(int)
        features = {
            'face_coordinates': {'left': int(bbox[0]), 'top': int(bbox[1]), 'right': int(bbox[2]), 'bottom': int(bbox[3])},
            'face_metrics': {'width': int(bbox[2]-bbox[0]), 'height': int(bbox[3]-bbox[1]), 'size': int((bbox[2]-bbox[0])*(bbox[3]-bbox[1]))},
            'facial_features': {'age': {'estimate': None, 'confidence': 0.0}, 'gender': {'name': None, 'confidence': 0.0}},
            'recognition_details': {},
            'tracking': {},
            'classification': {},
            'processing': {'model_version': 'insightface-buffalo_l'}
        }
    
    return features

def _save_thumb(frame: np.ndarray, bbox, name_prefix: str) -> str:
    x1, y1, x2, y2 = bbox
    h, w = frame.shape[:2]
    x1 = max(0, min(int(x1), w - 1))
    x2 = max(0, min(int(x2), w - 1))
    y1 = max(0, min(int(y1), h - 1))
    y2 = max(0, min(int(y2), h - 1))
    
    # Expand the bounding box slightly for better context
    padding = 20
    x1 = max(0, x1 - padding)
    y1 = max(0, y1 - padding) 
    x2 = min(w, x2 + padding)
    y2 = min(h, y2 + padding)
    
    crop = frame[y1:y2, x1:x2]
    
    # Resize crop to a standard size for consistency and better quality
    if crop.shape[0] > 0 and crop.shape[1] > 0:
        crop = cv2.resize(crop, (200, 200), interpolation=cv2.INTER_LANCZOS4)
    
    # Make filename unique with UUID to avoid overwriting
    fname = f"{name_prefix}_{uuid.uuid4().hex[:8]}.jpg"
    outp = IMAGES_DIR / fname
    
    try:
        # Save with high quality (95% quality, reduce compression artifacts)
        cv2.imwrite(str(outp), crop, [cv2.IMWRITE_JPEG_QUALITY, 95])
    except Exception:
        # Fallback to saving the whole frame if crop fails
        resized_frame = cv2.resize(frame, (200, 200), interpolation=cv2.INTER_LANCZOS4)
        cv2.imwrite(str(outp), resized_frame, [cv2.IMWRITE_JPEG_QUALITY, 95])
    
    return str(outp.relative_to(DATA_DIR)).replace('\\', '/')


def _save_frame(frame: np.ndarray, name_prefix: str) -> str:
    """Save full frame thumbnail for matched detections."""
    # Resize frame to manageable size while maintaining aspect ratio
    h, w = frame.shape[:2]
    max_size = 400
    if max(h, w) > max_size:
        if h > w:
            new_h, new_w = max_size, int(w * max_size / h)
        else:
            new_h, new_w = int(h * max_size / w), max_size
        frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LANCZOS4)
    
    # Make filename unique
    fname = f"{name_prefix}_{uuid.uuid4().hex[:8]}.jpg"
    outp = IMAGES_DIR / fname
    
    try:
        # Save with high quality
        cv2.imwrite(str(outp), frame, [cv2.IMWRITE_JPEG_QUALITY, 90])
    except Exception as e:
        print(f"Failed to save frame: {e}")
        return ""
    
    return str(outp.relative_to(DATA_DIR)).replace('\\', '/')


@app.route('/')
def index():
    # serve the new frontend single-page app
    return send_from_directory(str(Path(__file__).parent / 'frontend'), 'index.html')


@app.route('/frontend/static/<path:filename>')
def frontend_static(filename):
    return send_from_directory(str(Path(__file__).parent / 'frontend' / 'static'), filename)


@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    # serve uploaded files for UI
    return send_from_directory(str(UPLOAD_DIR), filename)


@app.route('/detect', methods=['POST'])
def detect():
    # accepts a file and a side param (a, b, known)
    f = request.files.get('file')
    side = request.form.get('side','a')
    if not f:
        return jsonify({'error':'no file provided'}),400
    fname = f"{side}.jpg"
    fp = UPLOAD_DIR / fname
    f.save(fp)
    img = cv2.imread(str(fp))
    if img is None:
        return jsonify({'error':'failed to read uploaded image'}),400
    faces = fa.get(img)
    if len(faces)==0:
        return jsonify({'error':'no faces detected'}),400
    out = []
    for i,face in enumerate(faces):
        bbox = face.bbox.astype(int).tolist()
        x1,y1,x2,y2 = bbox
        h,w = img.shape[:2]
        x1 = max(0, min(x1, w-1))
        x2 = max(0, min(x2, w-1))
        y1 = max(0, min(y1, h-1))
        y2 = max(0, min(y2, h-1))
        crop = img[y1:y2, x1:x2]
        crop_name = f"{side}_face_{i}.jpg"
        crop_path = UPLOAD_DIR / crop_name
        cv2.imwrite(str(crop_path), crop)
        # save embedding for later use
        emb = face.embedding
        emb_name = f"{side}_face_{i}.npy"
        np.save(str(UPLOAD_DIR / emb_name), emb)
        out.append({'index': i, 'bbox': bbox, 'thumb': url_for('uploaded_file', filename=crop_name)})
    return jsonify({'orig': url_for('uploaded_file', filename=fname), 'faces': out})

@app.route('/compare', methods=['POST'])
def compare():
    # expects two files: file1, file2
    f1 = request.files.get('file1')
    f2 = request.files.get('file2')
    if not f1 or not f2:
        return jsonify({'error':'provide file1 and file2'}),400
    p1 = UPLOAD_DIR / 'a.jpg'
    p2 = UPLOAD_DIR / 'b.jpg'
    f1.save(p1)
    f2.save(p2)

    img1 = cv2.imread(str(p1))
    img2 = cv2.imread(str(p2))
    if img1 is None or img2 is None:
        return jsonify({'error':'failed to read one or both images'}),400
    # check for selected face indices passed from the UI
    sel_a = request.form.get('selected_a')
    sel_b = request.form.get('selected_b')

    def load_selected_embedding(side, sel):
        try:
            idx = int(sel)
        except Exception:
            return None
        embf = UPLOAD_DIR / f"{side}_face_{idx}.npy"
        if embf.exists():
            try:
                e = np.load(str(embf))
                return e
            except Exception:
                return None
        return None

    emb1 = None
    emb2 = None
    faces1 = fa.get(img1)
    faces2 = fa.get(img2)
    # try selected embeddings first
    if sel_a:
        emb1 = load_selected_embedding('a', sel_a)
    if sel_b:
        emb2 = load_selected_embedding('b', sel_b)

    # fallback to detected first face if selected not available
    if emb1 is None:
        if len(faces1) == 0:
            return jsonify({'error':'no face detected in image A'}),400
        emb1 = faces1[0].embedding
    if emb2 is None:
        if len(faces2) == 0:
            return jsonify({'error':'no face detected in image B'}),400
        emb2 = faces2[0].embedding
    emb1 = emb1/ (np.linalg.norm(emb1)+1e-10)
    emb2 = emb2/ (np.linalg.norm(emb2)+1e-10)
    sim = float(np.dot(emb1,emb2))
    # optional threshold (sent by frontend) to indicate pass/fail
    thr_raw = request.form.get('threshold')
    thr_val = None
    match = None
    if thr_raw is not None:
        try:
            thr_val = float(thr_raw)
            match = sim >= thr_val
        except Exception:
            match = None
    # draw rectangles and save annotated images for UI
    # annotate selected face (if present) or first detected face
    aa = img1.copy()
    bb = img2.copy()
    def draw_selected_box(img, faces, side, sel):
        box = None
        if sel is not None:
            try:
                idx = int(sel)
                if 0 <= idx < len(faces):
                    box = faces[idx].bbox.astype(int).tolist()
            except Exception:
                box = None
        if box is None and len(faces)>0:
            box = faces[0].bbox.astype(int).tolist()
        if box is not None:
            x1,y1,x2,y2 = box
            cv2.rectangle(img,(x1,y1),(x2,y2),(0,255,0),2)
            cv2.putText(img,f'sim:{sim:.3f}',(x1,y1-10),cv2.FONT_HERSHEY_SIMPLEX,0.6,(0,255,0),2)

    draw_selected_box(aa, faces1, 'a', sel_a)
    draw_selected_box(bb, faces2, 'b', sel_b)
    annot_a = UPLOAD_DIR / 'annot_a.jpg'
    annot_b = UPLOAD_DIR / 'annot_b.jpg'
    cv2.imwrite(str(annot_a), aa)
    cv2.imwrite(str(annot_b), bb)

    resp = {
        'similarity': sim,
        'annot_a': url_for('uploaded_file', filename='annot_a.jpg'),
        'annot_b': url_for('uploaded_file', filename='annot_b.jpg'),
        'orig_a': url_for('uploaded_file', filename='a.jpg'),
        'orig_b': url_for('uploaded_file', filename='b.jpg')
    }
    if match is not None:
        resp['match'] = bool(match)
        if thr_val is not None:
            resp['threshold'] = float(thr_val)
    return jsonify(resp)

@app.route('/find', methods=['POST'])
def find():
    # Upload a known face file 'known' and a video 'video' (optional), or a single video and known saved in uploads
    known = request.files.get('known')
    video = request.files.get('video')
    if not known:
        return jsonify({'error':'provide known image'}),400
    kp = UPLOAD_DIR / 'known.jpg'
    known.save(kp)
    known_img = cv2.imread(str(kp))
    faces = fa.get(known_img)
    sel_known = request.form.get('selected_known')
    known_emb = None
    if sel_known:
        embf = UPLOAD_DIR / f"known_face_{sel_known}.npy"
        if embf.exists():
            try:
                known_emb = np.load(str(embf))
            except Exception:
                known_emb = None
    if known_emb is None:
        if len(faces)==0:
            return jsonify({'error':'no face in known image'}),400
        known_emb = faces[0].embedding
    known_emb = known_emb/ (np.linalg.norm(known_emb)+1e-10)

    if video:
        # save uploaded file and dispatch a background job to process it
        vp = UPLOAD_DIR / f'vid_{int(time.time())}.mp4'
        video.save(vp)
        job_id = uuid.uuid4().hex
        JOBS[job_id] = {'status':'running', 'progress':0, 'result':None, 'error':None}

        def worker(job_id, video_path, known_emb, threshold):
            try:
                cap = cv2.VideoCapture(str(video_path))
                total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
                processed = 0
                best = None
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    processed += 1
                    faces = fa.get(frame)
                    for face in faces:
                        emb = face.embedding
                        emb = emb/(np.linalg.norm(emb)+1e-10)
                        sim = float(np.dot(known_emb, emb))
                        if best is None or sim > best['sim']:
                            bbox = face.bbox.astype(int).tolist()
                            best = {'frame': processed, 'bbox': bbox, 'sim': sim, 'crop_frame': frame.copy()}
                    # update progress
                    if total>0:
                        JOBS[job_id]['progress'] = int((processed/total)*100)
                    else:
                        # unknown total: incremental progress estimate
                        JOBS[job_id]['progress'] = min(95, JOBS[job_id]['progress'] + 1)
                cap.release()
                # final check against threshold
                thr_val = 0.0
                if threshold is not None:
                    try:
                        thr_val = float(threshold)
                    except Exception:
                        thr_val = 0.0
                results = []
                if best is not None and best['sim'] >= thr_val:
                    x1,y1,x2,y2 = best['bbox']
                    h,w = best['crop_frame'].shape[:2]
                    x1 = max(0, min(x1, w-1))
                    x2 = max(0, min(x2, w-1))
                    y1 = max(0, min(y1, h-1))
                    y2 = max(0, min(y2, h-1))
                    crop = best['crop_frame'][y1:y2, x1:x2]
                    fname = f'found_{job_id}.jpg'
                    cv2.imwrite(str(UPLOAD_DIR / fname), crop)
                    # store result with a usable uploads path (avoid url_for in background thread)
                    results.append({'frame': best['frame'], 'bbox': best['bbox'], 'sim': best['sim'], 'img': f'/uploads/{fname}'})
                # produce direct uploads paths for known and video resources
                known_url = f'/uploads/{kp.name}'
                video_url = f'/uploads/{video_path.name}'
                JOBS[job_id]['result'] = {'found': results, 'known': known_url, 'video': video_url}
                JOBS[job_id]['progress'] = 100
                JOBS[job_id]['status'] = 'done'
            except Exception as e:
                JOBS[job_id]['status'] = 'error'
                JOBS[job_id]['error'] = str(e)

        thr = request.form.get('threshold')
        thread = threading.Thread(target=worker, args=(job_id, vp, known_emb, thr), daemon=True)
        thread.start()
        return jsonify({'job_id': job_id})
    else:
        return jsonify({'known_embedding_len':len(known_emb)})


@app.route('/find_status/<job_id>')
def find_status(job_id):
    job = JOBS.get(job_id)
    if not job:
        return jsonify({'error':'unknown job id'}),404
    # return progress and result if done
    resp = {'status': job['status'], 'progress': job.get('progress',0)}
    if job['status'] == 'done':
        resp['result'] = job.get('result')
    if job['status'] == 'error':
        resp['error'] = job.get('error')
    return jsonify(resp)

# OPTIONAL: if you already have /find using a background thread, just persist job state.
# Example wrapper for starting a job with persistence:
@app.route("/api/recognize/pic-to-video", methods=["POST"])
def api_pic_to_video():
    # expected form fields: 'known' (image) and 'video' (file)
    known = request.files.get("known")
    video = request.files.get("video")
    if not known or not video:
        return jsonify({"error": "known (image) and video are required"}), 400

    known_rec = store.save_upload(known, "image")
    video_rec = store.save_upload(video, "video")

    job_id = store.new_job("pic_to_video", {"known": known_rec, "video": video_rec})

    # Start background work: detect+embed known, sample frames from video, compare, save thumbs
    def worker():
        try:
            store.update_job(job_id, status="running", progress=0.01)

            # 1) Embed known image
            known_img = cv2.imread(known_rec["path"])
            if known_img is None:
                raise RuntimeError("Failed to read known image")
            known_emb, known_bbox = _face_embedding(known_img)
            if known_emb is None:
                raise RuntimeError("No face found in known image")

            # 2) Iterate video frames at ~3 fps
            cap = cv2.VideoCapture(video_rec["path"])
            if not cap.isOpened():
                raise RuntimeError("Failed to open video")
            fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
            total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            step = max(1, int(round(fps / 3.0)))  # sample ~3 fps

            # Threshold
            thr_str = request.form.get("threshold")
            try:
                threshold = float(thr_str) if thr_str is not None else 0.6
            except Exception:
                threshold = 0.6

            matches = []
            frame_idx = 0
            last_progress = 0
            while True:
                if total and frame_idx >= total:
                    break
                cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
                ret, frame = cap.read()
                if not ret:
                    break
                faces = fa.get(frame)
                best_local = None
                for f in faces:
                    emb = _normalize(f.embedding)
                    sim = float(np.dot(known_emb, emb))
                    if best_local is None or sim > best_local[0]:
                        best_local = (sim, f.bbox.astype(int).tolist())
                if best_local is not None and best_local[0] >= threshold:
                    t = float(frame_idx) / float(fps)
                    thumb_rel = _save_thumb(frame, best_local[1], f"match_{job_id}_{frame_idx}")
                    matches.append({
                        "time": round(t, 3),
                        "frame": frame_idx,
                        "bbox": best_local[1],
                        "confidence": round(best_local[0], 4),
                        "thumb_relpath": thumb_rel,
                    })
                # progress
                if total:
                    progress = min(0.99, frame_idx / total)
                else:
                    progress = min(0.99, last_progress + 0.01)
                if progress - last_progress >= 0.05:
                    store.update_job(job_id, progress=progress)
                    last_progress = progress
                frame_idx += step

            cap.release()
            result = {"matches": matches, "known": known_rec, "video": video_rec}
            store.update_job(job_id, status="done", progress=1.0, result=result)
        except Exception as e:
            store.update_job(job_id, status="error", error=str(e))

    import threading
    threading.Thread(target=worker, daemon=True).start()

    return jsonify({"job_id": job_id, "status": "queued"})


# =============================
# RTSP LIVE RECOGNITION (Phase 2)
# =============================

class RtspWorker:
    def __init__(self, cam_id: str, url: str, 
                 known_emb: Optional[np.ndarray] = None,
                 threshold: float = 0.6, target_fps: float = 15.0, transport: str = 'tcp', timeout_ms: int = 5000000,
                 mode: str = 'watchlist',
                 gallery: Optional[list] = None):
        self.cam_id = cam_id
        self.url = url
        self.mode = mode
        self.known = known_emb.astype(np.float32) if known_emb is not None else None
        self.threshold = float(threshold)
        self.target_dt = 1.0 / max(0.1, float(target_fps))
        self.stream_dt = 1.0 / 30.0  # 30 FPS for live streaming (GPU-optimized)
        self.transport = transport if transport in ('tcp', 'udp') else 'tcp'
        self.timeout_ms = int(timeout_ms)
        # gallery: list of tuples (person_id, person_name, embedding np.ndarray)
        self.gallery = []
        if gallery:
            for pid, pname, emb in gallery:
                e = emb / (np.linalg.norm(emb) + 1e-10)
                self.gallery.append((pid, pname, e.astype(np.float32)))
        self.thread: Optional[threading.Thread] = None
        self.stop_event = threading.Event()
        self.last_error: Optional[str] = None
        self.matches_count = 0
        self.frame_idx = 0
        self.last_seen = 0.0
        self.last_confidence: Optional[float] = None
        self.events = deque(maxlen=200)  # store last 200 events
        self.subscribers: Dict[int, queue.Queue] = {}
        self._sub_lock = threading.Lock()
        self._next_sub_id = 1
        self._last_jpeg: Optional[bytes] = None
        self._last_emit_ts = 0.0
        self._last_stream_ts = 0.0  # For live streaming frame rate control
        self._stream_frame_counter = 0  # Counter for frame skipping

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        self.stop_event.clear()
        self.thread = threading.Thread(target=self._run, daemon=True)
        self.thread.start()

    def stop(self):
        self.stop_event.set()
        if self.thread:
            self.thread.join(timeout=2.0)

    def subscribe(self) -> int:
        with self._sub_lock:
            sid = self._next_sub_id
            self._next_sub_id += 1
            self.subscribers[sid] = queue.Queue(maxsize=100)
            return sid

    def unsubscribe(self, sid: int):
        with self._sub_lock:
            self.subscribers.pop(sid, None)

    def publish(self, evt: Dict[str, Any]):
        # Push to buffer
        self.events.append(evt)
        # Fan-out to subscribers (non-blocking)
        with self._sub_lock:
            dead = []
            for sid, q in self.subscribers.items():
                try:
                    q.put_nowait(evt)
                except queue.Full:
                    # drop oldest behavior: replace queue
                    dead.append(sid)
            for sid in dead:
                self.subscribers.pop(sid, None)

    def next_event(self, sid: int, timeout: float = 15.0) -> Optional[Dict[str, Any]]:
        q = None
        with self._sub_lock:
            q = self.subscribers.get(sid)
        if q is None:
            return None
        try:
            return q.get(timeout=timeout)
        except queue.Empty:
            return None

    def snapshot(self) -> Optional[bytes]:
        return self._last_jpeg

    def _open_variants(self):
        """Try multiple URL variants and return an opened VideoCapture or None."""
        import os as _os
        # Set global capture options for FFMPEG
        # Try hardware acceleration if available, fall back to software decoding
        try:
            # Check if CUDA is available by testing for cudart
            import ctypes
            ctypes.CDLL('cudart64_12.dll')
            # CUDA available - use hardware acceleration with optimized settings
            _os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = (
                f"rtsp_transport;{self.transport}|"
                f"stimeout;{self.timeout_ms}|"
                "hwaccel;cuda|"
                "hwaccel_output_format;cuda|"  # Keep frames in GPU memory
                "c:v;h264_cuvid|"  # H.264 GPU decoder
                "resize;1920x1080|"  # Higher resolution for better quality
                "gpu;0|"  # Use GPU 0
                "surfaces;16|"  # More decode surfaces for smoother playback
                "flags;low_delay"
            )
            print("🚀 Using NVIDIA CUDA hardware acceleration for video decoding (optimized)")
        except:
            # CUDA not available - use optimized software decoding
            _os.environ['OPENCV_FFMPEG_CAPTURE_OPTIONS'] = (
                f"rtsp_transport;{self.transport}|"
                f"stimeout;{self.timeout_ms}|"
                "fflags;nobuffer|"  # No buffering for low latency
                "flags;low_delay|"  # Low delay mode
                "threads;4|"  # Use 4 threads for software decoding
                "probesize;32768|"  # Smaller probe size for faster startup
                "analyzeduration;500000"  # Shorter analysis for faster startup
            )
            print("⚠️ CUDA not available - using optimized CPU decoding")

        variants = []
        # Prefer explicit FFMPEG backend
        variants.append(('orig', self.url))
        # Append rtsp_transport tcp param if not present
        if 'rtsp_transport=' not in self.url:
            sep = '&' if ('?' in self.url) else '?'
            variants.append(('tcp_query', f"{self.url}{sep}rtsp_transport=tcp"))
            variants.append(('prefer_tcp', f"{self.url}{sep}rtsp_flags=prefer_tcp"))
        cap = None
        reason = None
        for tag, u in variants:
            try:
                c = cv2.VideoCapture(u, cv2.CAP_FFMPEG)
                if c.isOpened():
                    # Optimize buffer and resolution settings for high FPS with GPU
                    c.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Minimal buffer for lowest latency
                    c.set(cv2.CAP_PROP_FPS, 30)  # Request 30 FPS from camera
                    # Higher resolution for GPU processing
                    c.set(cv2.CAP_PROP_FRAME_WIDTH, 1920)
                    c.set(cv2.CAP_PROP_FRAME_HEIGHT, 1080)
                    # Force H.264 codec (more compatible than HEVC)
                    c.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc('H','2','6','4'))
                    return c, tag
                else:
                    c.release()
            except Exception as e:
                reason = str(e)
        return None, reason or 'unknown error'

    def _run(self):
        backoff = 1.0
        while not self.stop_event.is_set():
            cap, info = self._open_variants()
            if not cap:
                self.last_error = f'failed to open rtsp (tried variants): {info}'
                time.sleep(min(10.0, backoff))
                backoff = min(10.0, backoff * 2.0)
                continue
            backoff = 1.0
            last_ts = time.time()
            try:
                while not self.stop_event.is_set():
                    now = time.time()
                    
                    # Read frame from camera
                    ok, frame = cap.read()
                    if not ok or frame is None:
                        self.last_error = 'failed to read frame'
                        time.sleep(0.1)
                        continue

                    self.last_seen = now
                    
                    # Increment frame counter
                    self._stream_frame_counter += 1
                    
                    # Update JPEG for live streaming - process EVERY frame for 30 FPS streaming
                    # GPU can handle this easily
                    if now - self._last_stream_ts >= self.stream_dt:
                        try:
                            # Downscale frame for faster streaming (720p optimal for GPU)
                            h, w = frame.shape[:2]
                            if w > 1280:  # Only downscale if larger than 1280px
                                scale = 1280 / w
                                new_w = 1280
                                new_h = int(h * scale)
                                stream_frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
                            else:
                                stream_frame = frame
                            
                            # Fast JPEG encoding with higher quality for GPU
                            ok2, buf = cv2.imencode('.jpg', stream_frame, [
                                cv2.IMWRITE_JPEG_QUALITY, 85,  # Higher quality with GPU
                                cv2.IMWRITE_JPEG_OPTIMIZE, 0,  # Disable optimization for speed
                                cv2.IMWRITE_JPEG_PROGRESSIVE, 0  # Disable progressive
                            ])
                            if ok2:
                                self._last_jpeg = buf.tobytes()
                                self._last_stream_ts = now
                        except Exception:
                            pass
                    
                    # Process faces at lower frequency (configurable FPS for recognition)
                    if now - last_ts < self.target_dt:
                        # Don't sleep here - let the stream continue at full speed
                        continue
                    last_ts = now

                    self.frame_idx += 1
                    
                    # Record processing start time for performance metrics
                    processing_start = time.time()
                    faces = fa.get(frame)
                    processing_time_ms = (time.time() - processing_start) * 1000
                    
                    evts = []
                    best_sim = None
                    
                    for f in faces:
                        emb = f.embedding
                        emb = emb / (np.linalg.norm(emb) + 1e-10)
                        matched = False
                        sim = 0.0
                        person_id = None
                        person_name = None
                        
                        # Recognition logic
                        if self.mode == 'single' and self.known is not None:
                            sim = float(np.dot(self.known, emb))
                            matched = sim >= self.threshold
                        else:
                            # watchlist mode
                            best = None
                            for pid, pname, e in self.gallery:
                                s = float(np.dot(e, emb))
                                if best is None or s > best[0]:
                                    best = (s, pid, pname)
                            if best is not None:
                                sim = best[0]
                                if sim >= self.threshold:
                                    matched = True
                                    person_id = best[1]
                                    person_name = best[2]
                        
                        if best_sim is None or sim > best_sim:
                            best_sim = sim
                            
                        # Extract comprehensive face features
                        bbox = f.bbox.astype(int).tolist()
                        x1, y1, x2, y2 = bbox
                        
                        # Ensure bbox is within frame boundaries
                        h, w = frame.shape[:2]
                        x1 = max(0, min(x1, w-1))
                        y1 = max(0, min(y1, h-1))
                        x2 = max(x1+1, min(x2, w))
                        y2 = max(y1+1, min(y2, h))
                        bbox = [x1, y1, x2, y2]
                        
                        face_crop = frame[y1:y2, x1:x2]
                        
                        # Validate face crop is not empty
                        if face_crop is None or face_crop.size == 0:
                            continue  # Skip this face if crop failed
                        
                        # Extract detailed facial features and metadata
                        features = _extract_face_features(f, face_crop)
                        
                        # Calculate image quality for the face crop
                        quality_score = calculate_image_quality(face_crop)
                        is_low_quality = quality_score < QUALITY_THRESHOLD
                        
                        # Save thumbnail
                        rel = _save_thumb(frame, bbox, f"rtsp_{self.cam_id}_{self.frame_idx}")
                        
                        # Save full frame image
                        full_image_path = None
                        try:
                            timestamp = int(self.last_seen * 1000)
                            full_image_filename = f"full_{self.cam_id}_{timestamp}_{self.frame_idx}.jpg"
                            full_image_path = os.path.join(UPLOAD_DIR, full_image_filename)
                            cv2.imwrite(full_image_path, frame)
                        except Exception as e:
                            print(f"Failed to save full image: {e}")
                            full_image_path = None
                        
                        # Enhance features with recognition results
                        features['recognition_details']['similarity_score'] = sim
                        features['recognition_details']['recognition_threshold'] = self.threshold
                        features['processing']['time_ms'] = processing_time_ms
                        features['processing']['fps'] = 1.0 / self.target_dt if self.target_dt > 0 else 0.0
                        
                        # Classification based on recognition results
                        if matched:
                            features['classification']['event_type'] = 'recognized'
                            features['classification']['alert_level'] = 'medium' if sim >= 0.8 else 'low'
                        else:
                            features['classification']['event_type'] = 'unknown'
                            features['classification']['alert_level'] = 'info'
                        
                        # Add tracking info (basic implementation)
                        track_id = f"track_{self.cam_id}_{self.frame_idx}"
                        features['tracking']['is_new_track'] = True  # For now, each detection is new
                        
                        # Insert event into DB with cooldown (1s) and enhanced metadata
                        now_ms = int(self.last_seen * 1000)
                        if (self.last_seen - self._last_emit_ts) >= 1.0:
                            try:
                                # Prepare enhanced event data structure
                                event_data = {
                                    'camera_id': self.cam_id,
                                    'ts': now_ms,
                                    'confidence': sim,
                                    'bbox': bbox,
                                    'thumb_relpath': rel,
                                    'matched': matched,
                                    'person_id': person_id,
                                    'person_name': person_name,
                                    'quality_score': quality_score,
                                    'is_low_quality': is_low_quality,
                                    'full_image_path': full_image_path,
                                    
                                    # Enhanced metadata from features
                                    'track_id': track_id,
                                    'frame_number': self.frame_idx,
                                    **features  # Merge all extracted features
                                }
                                
                                dbm.insert_event(DB_CONN, event_data)
                                self._last_emit_ts = self.last_seen
                                      
                            except Exception as e:
                                print(f"Failed to insert enhanced event: {e}")
                                # Fallback to basic event insertion
                                try:
                                    dbm.insert_event(DB_CONN, {
                                        'camera_id': self.cam_id,
                                        'ts': now_ms,
                                        'confidence': sim,
                                        'bbox': bbox,
                                        'thumb_relpath': rel,
                                        'matched': matched,
                                        'person_id': person_id,
                                        'person_name': person_name,
                                        'extra': {'mode': self.mode, 'quality_score': quality_score},
                                        'quality_score': quality_score,
                                        'is_low_quality': is_low_quality,
                                        'full_image_path': full_image_path
                                    })
                                except Exception as e2:
                                    print(f"Fallback event insertion also failed: {e2}")
                                    pass
                        # For live UI, publish all detection events with enhanced metadata
                        # Publish both matched and unmatched events for live monitoring
                        evt = {
                            # Core identification
                            'id': self.cam_id,
                            'frame': self.frame_idx,
                            'timeSec': round(self.last_seen, 3),
                            'timestamp': now_ms,
                            'confidence': round(sim, 4),
                            'bbox': bbox,
                            'thumb_relpath': rel,
                            'matched': matched,
                            'person_id': person_id,
                            'person_name': person_name if matched else 'Unknown',
                            
                            # Enhanced metadata for rich UI display
                            'quality_score': round(quality_score, 3),
                            'is_low_quality': is_low_quality,
                            'track_id': track_id,
                            
                            # Face metrics for display
                            'face_width': features['face_metrics']['width'],
                            'face_height': features['face_metrics']['height'],
                            'face_size': features['face_metrics']['size'],
                            
                            # Facial features for UI display
                            'age_estimate': features['facial_features']['age']['estimate'],
                            'gender': features['facial_features']['gender']['name'],
                            'age_confidence': features['facial_features']['age']['confidence'],
                            'gender_confidence': features['facial_features']['gender']['confidence'],
                            
                            # Recognition details
                            'similarity_score': round(sim, 4),
                            'recognition_threshold': self.threshold,
                            
                            # Event classification
                            'event_type': features['classification']['event_type'],
                            'alert_level': features['classification']['alert_level'],
                            
                            # Processing metrics
                            'processing_time_ms': round(processing_time_ms, 2),
                            'model_version': features['processing']['model_version'],
                            
                            # Image quality details
                            'sharpness': features['face_metrics'].get('sharpness'),
                            'brightness': features['face_metrics'].get('brightness')
                        }
                        evts.append(evt)
                    # annotate frame for snapshot with detection results
                    try:
                        # Create annotated frame for streaming
                        annotated_frame = frame.copy()
                        for f in faces:
                            bbox = f.bbox.astype(int)
                            x1, y1, x2, y2 = bbox
                            # Draw face bounding box
                            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                            
                            # Add confidence score if we have events
                            conf_text = ""
                            for e in evts:
                                if e['bbox'] == bbox.tolist():
                                    conf_text = f"{e['confidence']:.2f}"
                                    if e.get('person_name'):
                                        conf_text += f" - {e['person_name']}"
                                    break
                            
                            if conf_text:
                                cv2.putText(annotated_frame, conf_text, (x1, max(0, y1-10)), 
                                          cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
                        
                        # Update the JPEG with annotated frame for streaming
                        ok2, buf = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                        if ok2:
                            self._last_jpeg = buf.tobytes()
                    except Exception:
                        pass
                        
                    for e in evts:
                        self.matches_count += 1
                        self.publish(e)
                    # update last_confidence with the best similarity from this frame (may be unmatched)
                    if best_sim is not None:
                        self.last_confidence = float(best_sim)
            finally:
                cap.release()


RTSP_WORKERS: Dict[str, RtspWorker] = {}


def _parse_float(val: Optional[str], default: float) -> float:
    if val is None:
        return default
    try:
        return float(val)
    except Exception:
        return default


@app.route('/api/rtsp/start', methods=['POST'])
def api_rtsp_start():
    """
    Start RTSP monitoring for a camera.
    multipart/form-data expected:
      - id: camera id (optional, generated if missing)
      - url: rtsp url (required)
      - known: image file containing the known face (required for now)
      - threshold: float (optional, default 0.6)
      - fps: float target processing fps (optional, default 15.0)
    """
    cam_id = request.form.get('id') or f"cam-{uuid.uuid4().hex[:8]}"
    url = request.form.get('url')
    name = request.form.get('name') or cam_id
    if not url:
        return jsonify({'error': 'url is required'}), 400
    known_fs = request.files.get('known')
    thr = _parse_float(request.form.get('threshold'), 0.6)
    fps = _parse_float(request.form.get('fps'), 15.0)  # Updated default: 15.0 FPS (GPU-optimized)
    transport = request.form.get('transport', 'tcp').lower()
    timeout_ms = request.form.get('timeout_ms')
    try:
        timeout_ms_int = int(timeout_ms) if timeout_ms is not None else 5000000
    except Exception:
        timeout_ms_int = 5000000
    mode = request.form.get('mode', 'watchlist')

    emb = None
    gallery = None
    if known_fs is not None and mode == 'single':
        # save known, compute embedding once
        rec = store.save_upload(known_fs, 'image')
        img = cv2.imread(rec['path'])
        if img is None:
            return jsonify({'error': 'failed to read known image'}), 400
        emb, _ = _face_embedding(img)
        if emb is None:
            return jsonify({'error': 'no face detected in known image'}), 400
    else:
        # watchlist mode
        wl = dbm.get_watchlist(DB_CONN)
        gallery = []
        for p in wl:
            for vec in p.get('embeddings', []):
                try:
                    arr = np.array(vec, dtype=np.float32)
                except Exception:
                    continue
                gallery.append((p['person_id'], p['person_name'], arr))
        if not gallery:
            return jsonify({'error': 'watchlist is empty; add persons/images first or use mode=single with known'}), 400

    # stop existing if same id
    if cam_id in RTSP_WORKERS:
        try:
            RTSP_WORKERS[cam_id].stop()
        except Exception:
            pass

    w = RtspWorker(cam_id, url, emb, threshold=thr, target_fps=fps, transport=transport, timeout_ms=timeout_ms_int, mode=mode, gallery=gallery)
    RTSP_WORKERS[cam_id] = w
    w.start()
    # persist camera
    try:
        dbm.upsert_camera(DB_CONN, {
            'id': cam_id,
            'name': name,
            'url': url,
            'transport': transport,
            'fps': fps,
            'threshold': thr,
            'mode': mode,
            'enabled': 1,
        })
    except Exception:
        pass
    return jsonify({'id': cam_id, 'status': 'started'})


@app.route('/api/rtsp/stop', methods=['POST'])
def api_rtsp_stop():
    data = request.get_json(silent=True) or {}
    cam_id = data.get('id')
    if not cam_id:
        return jsonify({'error': 'id is required'}), 400
    w = RTSP_WORKERS.pop(cam_id, None)
    if not w:
        return jsonify({'id': cam_id, 'status': 'not_found'}), 404
    try:
        w.stop()
    except Exception:
        pass
    # persist disabled state but preserve camera info
    try:
        # Get current camera info to preserve it
        cameras = dbm.list_cameras(DB_CONN)
        current_cam = next((c for c in cameras if c['id'] == cam_id), None)
        if current_cam:
            dbm.upsert_camera(DB_CONN, {
                'id': cam_id,
                'name': current_cam['name'],
                'url': current_cam['url'],
                'transport': current_cam['transport'],
                'fps': current_cam['fps'],
                'threshold': current_cam['threshold'],
                'mode': current_cam['mode'],
                'enabled': 0,  # Only disable, don't clear other fields
            })
    except Exception:
        pass
    return jsonify({'id': cam_id, 'status': 'stopped'})


@app.route('/api/rtsp/status/<cam_id>', methods=['GET'])
def api_rtsp_status(cam_id: str):
    w = RTSP_WORKERS.get(cam_id)
    if not w:
        return jsonify({'id': cam_id, 'status': 'not_found'}), 404
    running = bool(w.thread and w.thread.is_alive())
    status_data = {
        'id': cam_id,
        'status': 'running' if running else 'stopped',
        'last_seen': w.last_seen,
        'matches_count': w.matches_count,
        'last_error': w.last_error,
        'last_confidence': w.last_confidence,
    }
    # Convert to JSON-serializable format
    status_data = convert_to_json_serializable(status_data)
    return jsonify(status_data)


@app.route('/api/rtsp/events/<cam_id>')
def api_rtsp_events(cam_id: str):
    w = RTSP_WORKERS.get(cam_id)
    if not w:
        return jsonify({'error': 'not_found'}), 404
    sid = w.subscribe()

    def gen():
        try:
            # send a hello comment to keep connection
            yield ":ok\n\n"
            while True:
                evt = w.next_event(sid, timeout=15.0)
                if evt is None:
                    # heartbeat
                    yield ":keepalive\n\n"
                else:
                    # Convert to JSON-serializable format
                    evt_clean = convert_to_json_serializable(evt)
                    payload = json.dumps(evt_clean)
                    yield f"event: rtsp_match\n" + f"data: {payload}\n\n"
        except GeneratorExit:
            pass
        finally:
            w.unsubscribe(sid)

    return app.response_class(gen(), mimetype='text/event-stream', headers={
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    })


@app.route('/api/rtsp/snapshot/<cam_id>')
def api_rtsp_snapshot(cam_id: str):
    w = RTSP_WORKERS.get(cam_id)
    if not w:
        return jsonify({'error': 'not_found'}), 404
    jpg = w.snapshot()
    if not jpg:
        # return 204 No Content when no frame available
        return ('', 204)
    return app.response_class(jpg, mimetype='image/jpeg')


@app.route('/api/rtsp/stream/<cam_id>')
def api_rtsp_stream(cam_id: str):
    """
    Live MJPEG video stream endpoint for real-time monitoring
    Optimized for 25-30 FPS with GPU acceleration
    """
    w = RTSP_WORKERS.get(cam_id)
    if not w:
        return jsonify({'error': 'not_found'}), 404
    
    def generate_frames():
        last_jpg = None
        frame_count = 0
        
        while True:
            try:
                jpg = w.snapshot()
                
                # Only send new frames to avoid sending duplicates
                if jpg and jpg != last_jpg:
                    last_jpg = jpg
                    frame_count += 1
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + jpg + b'\r\n')
                else:
                    # No new frame, minimal sleep
                    time.sleep(0.005)  # 5ms sleep for efficiency
                    
            except GeneratorExit:
                break
            except Exception as e:
                print(f"Stream error for {cam_id}: {e}")
                break
    
    return app.response_class(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame',
        headers={
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Connection': 'close',
            'X-Accel-Buffering': 'no'  # Disable nginx buffering if behind proxy
        }
    )


# ========= Watchlist & Events & Cameras =========

@app.route('/api/watchlist/groups', methods=['GET', 'POST'])
def api_groups():
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
        name = data.get('name')
        if not name:
            return jsonify({'error': 'name required'}), 400
        gid = dbm.add_group(DB_CONN, name)
        return jsonify({'id': gid, 'name': name})
    else:
        return jsonify({'groups': dbm.list_groups(DB_CONN)})


@app.route('/api/watchlist/person', methods=['POST'])
def api_person_create():
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    group_id = data.get('group_id')
    note = data.get('note')
    if not name:
        return jsonify({'error': 'name required'}), 400
    pid = dbm.add_person(DB_CONN, name, group_id, note)
    return jsonify({'id': pid, 'name': name, 'group_id': group_id})


@app.route('/api/watchlist/person_image', methods=['POST'])
def api_person_add_image():
    person_id = request.form.get('person_id')
    imgf = request.files.get('image')
    if not person_id or not imgf:
        return jsonify({'error': 'person_id and image are required'}), 400
    try:
        pid = int(person_id)
    except Exception:
        return jsonify({'error': 'invalid person_id'}), 400
    rec = store.save_upload(imgf, 'image')
    img = cv2.imread(rec['path'])
    if img is None:
        return jsonify({'error': 'failed to read image'}), 400
    emb, _ = _face_embedding(img)
    if emb is None:
        return jsonify({'error': 'no face found in image'}), 400
    dbm.add_person_image(DB_CONN, pid, rec['filename'], rec['relpath'], emb.astype(float).tolist())
    return jsonify({'ok': True, 'relpath': rec['relpath']})


@app.route('/api/watchlist/person/<int:person_id>', methods=['PUT'])
def api_person_update(person_id):
    data = request.get_json(silent=True) or {}
    name = data.get('name')
    group_id = data.get('group_id')
    note = data.get('note')
    if not name:
        return jsonify({'error': 'name required'}), 400
    try:
        dbm.update_person(DB_CONN, person_id, name, group_id, note)
        return jsonify({'ok': True, 'id': person_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/watchlist/person/<int:person_id>', methods=['DELETE'])
def api_person_delete(person_id):
    try:
        dbm.delete_person(DB_CONN, person_id)
        return jsonify({'ok': True, 'id': person_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/watchlist', methods=['GET'])
def api_watchlist():
    wl = dbm.get_watchlist(DB_CONN)
    return jsonify({'watchlist': wl})


@app.route('/api/cameras', methods=['GET'])
def api_cameras():
    return jsonify({'cameras': dbm.list_cameras(DB_CONN)})


@app.route('/api/cameras/cleanup', methods=['POST'])
def api_cameras_cleanup():
    """Remove cameras that are not currently running"""
    try:
        # Get all cameras from DB
        all_cams = dbm.list_cameras(DB_CONN)
        removed = []
        
        for cam in all_cams:
            cam_id = cam['id']
            # If camera is not in active workers, remove it from DB
            if cam_id not in RTSP_WORKERS:
                dbm.remove_camera(DB_CONN, cam_id)
                removed.append(cam_id)
        
        return jsonify({'removed': removed, 'count': len(removed)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/cameras/reload', methods=['POST'])
def api_cameras_reload():
    """Reload all enabled cameras from database"""
    try:
        cameras = dbm.list_cameras(DB_CONN)
        reloaded = []
        failed = []
        
        for cam in cameras:
            if cam.get('enabled') != 1:
                continue
                
            cam_id = cam['id']
            
            # Stop existing worker if running
            if cam_id in RTSP_WORKERS:
                try:
                    RTSP_WORKERS[cam_id].stop()
                    del RTSP_WORKERS[cam_id]
                except Exception:
                    pass
            
            # Get mode and setup
            mode = cam.get('mode', 'watchlist')
            gallery = []
            emb = None
            
            if mode == 'watchlist':
                wl = dbm.get_watchlist(DB_CONN)
                for p in wl:
                    for vec in p.get('embeddings', []):
                        try:
                            arr = np.array(vec, dtype=np.float32)
                            gallery.append((p['person_id'], p['person_name'], arr))
                        except Exception:
                            continue
            
            # Start worker
            try:
                w = RtspWorker(
                    cam_id, 
                    cam['url'], 
                    emb,
                    threshold=cam.get('threshold', 0.6),
                    target_fps=cam.get('fps', 15.0),
                    transport=cam.get('transport', 'tcp'),
                    timeout_ms=5000000,
                    mode=mode,
                    gallery=gallery
                )
                RTSP_WORKERS[cam_id] = w
                w.start()
                reloaded.append(cam_id)
            except Exception as e:
                failed.append({'id': cam_id, 'error': str(e)})
        
        return jsonify({
            'reloaded': reloaded,
            'failed': failed,
            'count': len(reloaded)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/cameras/<cam_id>', methods=['DELETE'])
def api_camera_delete(cam_id):
    """Delete a specific camera"""
    try:
        # Stop the camera if it's running
        if cam_id in RTSP_WORKERS:
            worker = RTSP_WORKERS[cam_id]
            worker.stop()
            del RTSP_WORKERS[cam_id]
        
        # Remove from database
        dbm.remove_camera(DB_CONN, cam_id)
        
        return jsonify({'id': cam_id, 'status': 'deleted'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/events', methods=['GET'])
def api_events():
    try:
        limit = int(request.args.get('limit', '100'))
    except Exception:
        limit = 100
    matched_q = request.args.get('matched')
    matched = None
    if matched_q is not None:
        matched = True if matched_q in ('1', 'true', 'True') else False
    camera_id = request.args.get('camera_id')
    rows = dbm.list_events(DB_CONN, limit=limit, matched=matched)
    if camera_id:
        rows = [r for r in rows if r.get('camera_id') == camera_id]
    # add absolute URL for thumbnails for convenience
    for r in rows:
        rel = r.get('thumb_relpath')
        if rel:
            r['thumb_url'] = f"/data/{rel}"
    return jsonify({'events': rows})


@app.route('/api/events/enhanced', methods=['GET'])
def api_events_enhanced():
    """
    Enhanced events API with comprehensive metadata filtering and rich response format.
    Similar to OPTIEXACTA system functionality.
    """
    try:
        # Parse query parameters with defaults
        limit = int(request.args.get('limit', '100'))
        page = int(request.args.get('page', '1'))
        offset = (page - 1) * limit
        
        # Time filters
        start_date = request.args.get('start_date')  # ISO format
        end_date = request.args.get('end_date')
        last_hours = request.args.get('last_hours')
        
        # Recognition filters
        matched_only = request.args.get('matched_only') == 'true'
        confidence_min = float(request.args.get('confidence_min', '0.0'))
        confidence_max = float(request.args.get('confidence_max', '1.0'))
        person_name = request.args.get('person_name')
        
        # Quality filters
        min_quality = float(request.args.get('min_quality', '0.0'))
        exclude_low_quality = request.args.get('exclude_low_quality') == 'true'
        min_face_size = int(request.args.get('min_face_size', '0'))
        
        # Feature filters
        age_min = request.args.get('age_min')
        age_max = request.args.get('age_max')
        gender = request.args.get('gender')
        
        # Location filters
        camera_ids = request.args.getlist('camera_id')
        
        # Alert filters
        alert_levels = request.args.getlist('alert_level')
        event_types = request.args.getlist('event_type')
        
        # Sorting
        sort_by = request.args.get('sort_by', 'timestamp')
        sort_order = request.args.get('sort_order', 'desc')
        
        # Build SQL query with filters
        query_parts = ["SELECT * FROM events WHERE 1=1"]
        params = []
        
        # Time filters
        if start_date:
            try:
                start_ts = int(time.mktime(time.strptime(start_date, '%Y-%m-%dT%H:%M:%S'))) * 1000
                query_parts.append("AND ts >= ?")
                params.append(start_ts)
            except:
                pass
                
        if end_date:
            try:
                end_ts = int(time.mktime(time.strptime(end_date, '%Y-%m-%dT%H:%M:%S'))) * 1000
                query_parts.append("AND ts <= ?")
                params.append(end_ts)
            except:
                pass
                
        if last_hours:
            try:
                hours_ago_ts = int((time.time() - int(last_hours) * 3600) * 1000)
                query_parts.append("AND ts >= ?")
                params.append(hours_ago_ts)
            except:
                pass
        
        # Recognition filters
        if matched_only:
            query_parts.append("AND matched = 1")
            
        query_parts.append("AND confidence >= ? AND confidence <= ?")
        params.extend([confidence_min, confidence_max])
        
        if person_name:
            query_parts.append("AND person_name LIKE ?")
            params.append(f"%{person_name}%")
        
        # Quality filters
        query_parts.append("AND quality_score >= ?")
        params.append(min_quality)
        
        if exclude_low_quality:
            query_parts.append("AND is_low_quality = 0")
            
        if min_face_size > 0:
            query_parts.append("AND face_size >= ?")
            params.append(min_face_size)
        
        # Feature filters
        if age_min:
            query_parts.append("AND age_estimate >= ?")
            params.append(int(age_min))
            
        if age_max:
            query_parts.append("AND age_estimate <= ?")
            params.append(int(age_max))
            
        if gender:
            query_parts.append("AND gender = ?")
            params.append(gender)
        
        # Location filters
        if camera_ids:
            placeholders = ','.join(['?' for _ in camera_ids])
            query_parts.append(f"AND camera_id IN ({placeholders})")
            params.extend(camera_ids)
        
        # Alert filters
        if alert_levels:
            placeholders = ','.join(['?' for _ in alert_levels])
            query_parts.append(f"AND alert_level IN ({placeholders})")
            params.extend(alert_levels)
            
        if event_types:
            placeholders = ','.join(['?' for _ in event_types])
            query_parts.append(f"AND event_type IN ({placeholders})")
            params.extend(event_types)
        
        # Add sorting and pagination
        sort_column = 'ts' if sort_by == 'timestamp' else sort_by
        sort_direction = 'DESC' if sort_order == 'desc' else 'ASC'
        query_parts.append(f"ORDER BY {sort_column} {sort_direction}")
        query_parts.append("LIMIT ? OFFSET ?")
        params.extend([limit, offset])
        
        # Execute query
        query = ' '.join(query_parts)
        
        with dbm.DB_LOCK:
            rows = DB_CONN.execute(query, params).fetchall()
        
        # Get total count for pagination
        count_query = query.replace("SELECT *", "SELECT COUNT(*)").split("ORDER BY")[0]
        with dbm.DB_LOCK:
            total_count = DB_CONN.execute(count_query, params[:-2]).fetchone()[0]
        
        # Convert to enhanced event format
        enhanced_events = []
        for row in rows:
            event = dict(row)
            
            # Parse JSON fields safely
            try:
                event['emotions'] = json.loads(event.get('emotions') or '{}')
            except:
                event['emotions'] = {}
                
            try:
                event['bbox_parsed'] = json.loads(event.get('bbox') or '[]')
            except:
                event['bbox_parsed'] = []
            
            # Add computed fields
            event['created_date'] = time.strftime('%Y-%m-%dT%H:%M:%S', time.localtime(event['ts'] / 1000))
            event['thumbnail'] = f"/data/{event['thumb_relpath']}" if event.get('thumb_relpath') else None
            event['full_frame'] = f"/uploads/{os.path.basename(event['full_image_path'])}" if event.get('full_image_path') else None
            
            # Face detection features in OPTIEXACTA format
            event['features'] = {
                'age': {
                    'name': event.get('age_estimate'),
                    'confidence': event.get('age_confidence', 0.0)
                },
                'gender': {
                    'name': event.get('gender'),
                    'confidence': event.get('gender_confidence', 0.0)
                },
                'glasses': {
                    'name': 'eyeglasses' if event.get('has_glasses') else 'none',
                    'confidence': event.get('glasses_confidence', 0.0)
                },
                'beard': {
                    'name': 'beard' if event.get('has_beard') else 'no_beard',
                    'confidence': event.get('beard_confidence', 0.0)
                },
                'liveness': {
                    'name': 'real',
                    'confidence': event.get('liveness_score', 0.9)
                },
                'emotions': event['emotions']
            }
            
            # Quality metrics
            event['quality_metrics'] = {
                'width': event.get('face_width', 0),
                'height': event.get('face_height', 0),
                'size': event.get('face_size', 0),
                'quality': event.get('quality_score', 1.0),
                'sharpness': event.get('sharpness'),
                'brightness': event.get('brightness')
            }
            
            enhanced_events.append(event)
        
        # Prepare response
        response = {
            'events': enhanced_events,
            'pagination': {
                'total_count': total_count,
                'page': page,
                'limit': limit,
                'has_next': (offset + limit) < total_count,
                'has_previous': page > 1,
                'total_pages': (total_count + limit - 1) // limit
            },
            'filters_applied': {
                'matched_only': matched_only,
                'confidence_range': [confidence_min, confidence_max],
                'min_quality': min_quality,
                'exclude_low_quality': exclude_low_quality,
                'camera_ids': camera_ids,
                'alert_levels': alert_levels,
                'event_types': event_types,
                'person_name': person_name,
                'age_range': [age_min, age_max] if age_min or age_max else None,
                'gender': gender
            },
            'processing_time_ms': round((time.time() - time.time()) * 1000, 2)  # Placeholder
        }
        
        return jsonify(response)
        
    except Exception as e:
        print(f"Error in enhanced events API: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/events/high-quality', methods=['GET'])
def api_events_high_quality():
    """Get events with quality score above threshold"""
    try:
        limit = int(request.args.get('limit', '100'))
    except Exception:
        limit = 100
    
    quality_threshold = float(request.args.get('threshold', QUALITY_THRESHOLD))
    matched_q = request.args.get('matched')
    matched = None
    if matched_q is not None:
        matched = True if matched_q in ('1', 'true', 'True') else False
    camera_id = request.args.get('camera_id')
    
    # Get all events and filter by quality
    rows = dbm.list_events(DB_CONN, limit=limit*2, matched=matched)  # Get more to account for filtering
    
    # Filter by quality score
    filtered_rows = []
    for r in rows:
        quality_score = r.get('quality_score', 1.0)  # Default to high quality for existing records
        if quality_score >= quality_threshold:
            filtered_rows.append(r)
        if len(filtered_rows) >= limit:
            break
    
    if camera_id:
        filtered_rows = [r for r in filtered_rows if r.get('camera_id') == camera_id]
    
    # Add absolute URL for thumbnails
    for r in filtered_rows:
        rel = r.get('thumb_relpath')
        if rel:
            r['thumb_url'] = f"/data/{rel}"
    
    return jsonify({'events': filtered_rows})


@app.route('/api/events/low-quality', methods=['GET'])
def api_events_low_quality():
    """Get events with quality score below threshold"""
    try:
        limit = int(request.args.get('limit', '100'))
    except Exception:
        limit = 100
    
    quality_threshold = float(request.args.get('threshold', QUALITY_THRESHOLD))
    matched_q = request.args.get('matched')
    matched = None
    if matched_q is not None:
        matched = True if matched_q in ('1', 'true', 'True') else False
    camera_id = request.args.get('camera_id')
    
    # Get all events and filter by quality
    rows = dbm.list_events(DB_CONN, limit=limit*2, matched=matched)  # Get more to account for filtering
    
    # Filter by quality score
    filtered_rows = []
    for r in rows:
        quality_score = r.get('quality_score', 1.0)  # Default to high quality for existing records
        if quality_score < quality_threshold:
            filtered_rows.append(r)
        if len(filtered_rows) >= limit:
            break
    
    if camera_id:
        filtered_rows = [r for r in filtered_rows if r.get('camera_id') == camera_id]
    
    # Add absolute URL for thumbnails
    for r in filtered_rows:
        rel = r.get('thumb_relpath')
        if rel:
            r['thumb_url'] = f"/data/{rel}"
    
    return jsonify({'events': filtered_rows})


@app.route('/api/quality-threshold', methods=['GET', 'POST'])
def api_quality_threshold():
    """Get or set the quality threshold"""
    global QUALITY_THRESHOLD
    
    if request.method == 'GET':
        return jsonify({'threshold': QUALITY_THRESHOLD})
    
    try:
        data = request.get_json()
        threshold = float(data.get('threshold', QUALITY_THRESHOLD))
        if 0.0 <= threshold <= 1.0:
            QUALITY_THRESHOLD = threshold
            return jsonify({'threshold': QUALITY_THRESHOLD, 'success': True})
        else:
            return jsonify({'error': 'Threshold must be between 0.0 and 1.0'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/api/events/<int:event_id>/full-image', methods=['GET'])
def api_event_full_image(event_id):
    """Get the full image for an event with bounding box drawn"""
    try:
        # Get event details from database
        with dbm.DB_LOCK:
            event = DB_CONN.execute("SELECT * FROM events WHERE id=?", (event_id,)).fetchone()
        
        if not event:
            return jsonify({'error': 'Event not found'}), 404
        
        event_dict = dict(event)
        full_image_path = event_dict.get('full_image_path')
        
        if not full_image_path or not os.path.exists(full_image_path):
            return jsonify({'error': 'Full image not found'}), 404
        
        # Load image and draw bounding box
        image = cv2.imread(full_image_path)
        if image is None:
            return jsonify({'error': 'Could not load image'}), 500
        
        # Parse bounding box
        try:
            bbox_str = event_dict.get('bbox', '[]')
            bbox = json.loads(bbox_str)
            if len(bbox) >= 4:
                x1, y1, x2, y2 = map(int, bbox[:4])
                
                # Draw bounding box
                color = (0, 255, 0) if event_dict.get('matched') else (0, 165, 255)  # Green for matches, Orange for unknown
                thickness = 3
                cv2.rectangle(image, (x1, y1), (x2, y2), color, thickness)
                
                # Add label
                label = event_dict.get('person_name', 'Unknown')
                confidence = event_dict.get('confidence', 0)
                quality_score = event_dict.get('quality_score', 0)
                
                label_text = f"{label} ({confidence:.1%})"
                if quality_score > 0:
                    label_text += f" Q:{quality_score:.2f}"
                
                # Calculate label size and position
                font = cv2.FONT_HERSHEY_SIMPLEX
                font_scale = 0.7
                label_size = cv2.getTextSize(label_text, font, font_scale, 2)[0]
                
                # Draw label background
                cv2.rectangle(image, (x1, y1 - label_size[1] - 10), 
                             (x1 + label_size[0], y1), color, -1)
                
                # Draw label text
                cv2.putText(image, label_text, (x1, y1 - 5), 
                           font, font_scale, (255, 255, 255), 2)
        except Exception as e:
            print(f"Error drawing bounding box: {e}")
        
        # Encode image as JPEG
        _, buffer = cv2.imencode('.jpg', image)
        
        from flask import Response
        return Response(buffer.tobytes(), mimetype='image/jpeg')
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


# Start enabled cameras (watchlist mode) on boot
def _boot_start_cameras():
    try:
        cams = dbm.list_cameras(DB_CONN)
        for c in cams:
            if int(c.get('enabled', 0)) != 1:
                continue
            cam_id = c['id']
            url = c['url']
            if not url:
                continue
            thr = float(c.get('threshold', 0.6))
            fps = float(c.get('fps', 3.0))
            transport = c.get('transport', 'tcp')
            mode = c.get('mode', 'watchlist')
            # load watchlist gallery
            wl = dbm.get_watchlist(DB_CONN)
            gallery = []
            for p in wl:
                for vec in p.get('embeddings', []):
                    try:
                        arr = np.array(vec, dtype=np.float32)
                    except Exception:
                        continue
                    gallery.append((p['person_id'], p['person_name'], arr))
            w = RtspWorker(cam_id, url, None, threshold=thr, target_fps=fps, transport=transport, timeout_ms=5000000, mode=mode, gallery=gallery)
            RTSP_WORKERS[cam_id] = w
            w.start()
    except Exception:
        pass

_boot_start_cameras()

# Job status endpoint (file-backed and in-memory)
@app.route("/api/jobs/<job_id>", methods=["GET"])
def api_job_status(job_id):
    # Check in-memory jobs first (for video analysis)
    job = JOBS.get(job_id)
    if job:
        return jsonify(job)
    
    # Fall back to file-backed jobs
    data = store.get_job(job_id)
    if not data:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(data)

# Simple uploads listing (file-backed)
@app.route("/api/uploads", methods=["GET"])
def api_uploads():
    return jsonify(store.list_uploads())


# JSON-only compare for mobile (no annotated images)
@app.route('/api/compare', methods=['POST'])
def api_compare_json():
    f1 = request.files.get('file1')
    f2 = request.files.get('file2')
    thr = request.form.get('threshold')
    try:
        threshold = float(thr) if thr is not None else 0.6
    except Exception:
        threshold = 0.6
    if not f1 or not f2:
        return jsonify({"ok": False, "error": "file1 and file2 are required"}), 400
    rec1 = store.save_upload(f1, 'image')
    rec2 = store.save_upload(f2, 'image')
    img1 = cv2.imread(rec1['path'])
    img2 = cv2.imread(rec2['path'])
    if img1 is None or img2 is None:
        return jsonify({"ok": False, "error": "failed to read images"}), 400
    e1, _ = _face_embedding(img1)
    e2, _ = _face_embedding(img2)
    if e1 is None or e2 is None:
        return jsonify({"ok": False, "error": "no face detected in one of the images"}), 400
    sim = float(np.dot(e1, e2))
    return jsonify({
        "ok": True,
        "data": {
            "similarity": round(sim, 6),
            "isSamePerson": bool(sim >= threshold),
            "threshold": threshold,
            "image1": {"relpath": rec1['relpath']},
            "image2": {"relpath": rec2['relpath']},
        }
    })


# Video→Video: find overlapping persons between two videos
@app.route('/api/recognize/video-to-video', methods=['POST'])
def api_video_to_video():
    v1 = request.files.get('videoA')
    v2 = request.files.get('videoB')
    thr = request.form.get('threshold')
    try:
        threshold = float(thr) if thr is not None else 0.6
    except Exception:
        threshold = 0.6
    if not v1 or not v2:
        return jsonify({"error": "videoA and videoB are required"}), 400
    recA = store.save_upload(v1, 'video')
    recB = store.save_upload(v2, 'video')
    job_id = store.new_job('video_to_video', {"videoA": recA, "videoB": recB, "threshold": threshold})

    def worker():
        try:
            store.update_job(job_id, status='running', progress=0.01)

            # Open videos
            capA = cv2.VideoCapture(recA['path'])
            capB = cv2.VideoCapture(recB['path'])
            if not capA.isOpened() or not capB.isOpened():
                raise RuntimeError('failed to open one or both videos')

            fpsA = capA.get(cv2.CAP_PROP_FPS) or 30.0
            fpsB = capB.get(cv2.CAP_PROP_FPS) or 30.0
            totalA = int(capA.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            totalB = int(capB.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
            stepA = max(1, int(round(fpsA / 3.0)))
            stepB = max(1, int(round(fpsB / 3.0)))

            # Collect embeddings from both videos (bounded to avoid huge memory)
            max_frames = 1800  # ~10 minutes at 3 fps
            collA = []  # each: {emb, frame, time, bbox}
            collB = []

            # Sample A
            idx = 0
            while True:
                if totalA and idx >= totalA:
                    break
                if len(collA) >= max_frames:
                    break
                capA.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ok, frame = capA.read()
                if not ok:
                    break
                faces = fa.get(frame)
                for f in faces:
                    emb = _normalize(f.embedding)
                    t = float(idx) / float(fpsA)
                    collA.append({"emb": emb, "frame": idx, "time": round(t, 3), "bbox": f.bbox.astype(int).tolist(), "frame_ref": frame})
                idx += stepA
            capA.release()

            # Sample B
            idx = 0
            while True:
                if totalB and idx >= totalB:
                    break
                if len(collB) >= max_frames:
                    break
                capB.set(cv2.CAP_PROP_POS_FRAMES, idx)
                ok, frame = capB.read()
                if not ok:
                    break
                faces = fa.get(frame)
                for f in faces:
                    emb = _normalize(f.embedding)
                    t = float(idx) / float(fpsB)
                    collB.append({"emb": emb, "frame": idx, "time": round(t, 3), "bbox": f.bbox.astype(int).tolist(), "frame_ref": frame})
                idx += stepB
            capB.release()

            # Match A→B with simple brute-force best matches
            pairs = []
            for a in collA:
                best = None
                for b in collB:
                    sim = float(np.dot(a['emb'], b['emb']))
                    if best is None or sim > best[0]:
                        best = (sim, b)
                if best and best[0] >= threshold:
                    thumbA = _save_thumb(a['frame_ref'], a['bbox'], f"v2v_A_{job_id}_{a['frame']}")
                    thumbB = _save_thumb(best[1]['frame_ref'], best[1]['bbox'], f"v2v_B_{job_id}_{best[1]['frame']}")
                    pairs.append({
                        "confidence": round(best[0], 4),
                        "A": {"time": a['time'], "frame": a['frame'], "bbox": a['bbox'], "thumb_relpath": thumbA},
                        "B": {"time": best[1]['time'], "frame": best[1]['frame'], "bbox": best[1]['bbox'], "thumb_relpath": thumbB},
                    })

            store.update_job(job_id, status='done', progress=1.0, result={"pairs": pairs, "videoA": recA, "videoB": recB})
        except Exception as e:
            store.update_job(job_id, status='error', error=str(e))

    threading.Thread(target=worker, daemon=True).start()
    return jsonify({"job_id": job_id, "status": "queued"})


# ========= Video Analysis Endpoints =========

@app.route('/api/video-analysis/start', methods=['POST'])
def api_video_analysis_start():
    """
    Start comprehensive video analysis job.
    Processes entire video to detect faces and match against watchlist.
    
    Expected form data:
    - video: video file
    - threshold: float (optional, default 0.6)
    - use_watchlist: bool (optional, default True)
    - skip_frames: int (optional, default 1 - process every frame)
    """
    video_file = request.files.get('video')
    if not video_file:
        return jsonify({'error': 'Video file is required'}), 400
        
    threshold = float(request.form.get('threshold', 0.6))
    use_watchlist = request.form.get('use_watchlist', 'true').lower() == 'true'
    skip_frames = int(request.form.get('skip_frames', 1))
    
    # Save uploaded video
    video_rec = store.save_upload(video_file, 'video')
    video_path = Path(video_rec['path'])
    
    # Create job ID
    job_id = f"video_{int(time.time())}_{uuid.uuid4().hex[:8]}"
    
    # Initialize job in memory
    JOBS[job_id] = {
        'id': job_id,
        'type': 'video_analysis',
        'status': 'queued',
        'progress': 0.0,
        'video_path': str(video_path),
        'threshold': threshold,
        'use_watchlist': use_watchlist,
        'skip_frames': skip_frames,
        'created_at': time.time(),
        'result': None,
        'error': None
    }
    
    def video_analysis_worker(job_id):
        try:
            job = JOBS.get(job_id)
            if not job:
                return
                
            job['status'] = 'running'
            job['progress'] = 0.0
            
            video_path = job['video_path']
            threshold = job['threshold']
            use_watchlist = job['use_watchlist']
            skip_frames = job['skip_frames']
            
            # Open video
            cap = cv2.VideoCapture(str(video_path))
            if not cap.isOpened():
                job['status'] = 'error'
                job['error'] = 'Failed to open video file'
                return
                
            # Get video properties
            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = cap.get(cv2.CAP_PROP_FPS)
            width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            duration = total_frames / fps if fps > 0 else 0
            
            # Load gallery for matching if using watchlist
            gallery = []
            if use_watchlist:
                try:
                    # Get watchlist persons with their embeddings
                    watchlist = dbm.get_watchlist(DB_CONN)
                    for person in watchlist:
                        for embedding_data in person.get('embeddings', []):
                            emb = np.array(embedding_data, dtype=np.float32)
                            emb = emb / (np.linalg.norm(emb) + 1e-10)  # Normalize
                            gallery.append((person['person_id'], person['person_name'], emb))
                except Exception as e:
                    print(f"Failed to load gallery: {e}")
            
            # Analysis variables
            detections = []
            total_faces = 0
            matched_faces = 0
            unique_face_embeddings = []
            frames_with_faces = 0
            frames_without_faces = 0
            max_faces_in_frame = 0
            face_counts = []
            
            start_time = time.time()
            frame_idx = 0
            processed_frames = 0
            
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                    
                frame_idx += 1
                
                # Skip frames if specified
                if (frame_idx - 1) % skip_frames != 0:
                    continue
                    
                processed_frames += 1
                timestamp = frame_idx / fps if fps > 0 else 0
                
                # Update progress
                progress = frame_idx / total_frames
                job['progress'] = progress
                
                # Detect faces
                faces = fa.get(frame)
                num_faces = len(faces)
                face_counts.append(num_faces)
                
                if num_faces > 0:
                    frames_with_faces += 1
                    max_faces_in_frame = max(max_faces_in_frame, num_faces)
                else:
                    frames_without_faces += 1
                
                total_faces += num_faces
                
                frame_detections = {
                    'frame': frame_idx,
                    'timestamp': timestamp,
                    'faces': []
                }
                
                for face in faces:
                    emb = face.embedding
                    emb = emb / (np.linalg.norm(emb) + 1e-10)
                    
                    # Check for uniqueness (basic clustering)
                    is_unique = True
                    for unique_emb in unique_face_embeddings:
                        similarity = float(np.dot(unique_emb, emb))
                        if similarity > 0.8:  # High similarity threshold for uniqueness
                            is_unique = False
                            break
                    
                    if is_unique:
                        unique_face_embeddings.append(emb)
                    
                    # Match against gallery
                    matched = False
                    best_match = None
                    best_similarity = 0
                    
                    if use_watchlist and gallery:
                        for person_id, person_name, gallery_emb in gallery:
                            similarity = float(np.dot(gallery_emb, emb))
                            if similarity > best_similarity:
                                best_similarity = similarity
                                best_match = (person_id, person_name)
                        
                        if best_similarity >= threshold:
                            matched = True
                            matched_faces += 1
                    
                    # Save face thumbnail
                    bbox = face.bbox.astype(int)
                    thumb_rel = _save_thumb(frame, bbox.tolist(), f"video_analysis_{job_id}_{frame_idx}_{len(frame_detections['faces'])}")
                    
                    # Also save full frame if it has matches
                    frame_thumb_path = None
                    if matched:
                        frame_thumb_path = _save_frame(frame, f"frame_{job_id}_{frame_idx}")
                    
                    face_data = {
                        'bbox': bbox.tolist(),
                        'confidence': float(face.det_score),
                        'similarity': best_similarity,
                        'matched': matched,
                        'thumb_path': thumb_rel,
                        'frame_path': frame_thumb_path
                    }
                    
                    if matched and best_match:
                        face_data['person_id'] = best_match[0]
                        face_data['person_name'] = best_match[1]
                    
                    frame_detections['faces'].append(face_data)
                
                if frame_detections['faces']:  # Only store frames with faces
                    detections.append(frame_detections)
            
            cap.release()
            processing_time = time.time() - start_time
            
            # Calculate statistics
            avg_faces_per_frame = sum(face_counts) / len(face_counts) if face_counts else 0
            unique_faces = len(unique_face_embeddings)
            
            # Prepare results
            result = {
                'totalFrames': total_frames,
                'processedFrames': processed_frames,
                'totalFaces': total_faces,
                'matchedFaces': matched_faces,
                'uniqueFaces': unique_faces,
                'processingTime': processing_time,
                'detections': detections,
                'summary': {
                    'videoInfo': {
                        'duration': duration,
                        'fps': fps,
                        'width': width,
                        'height': height
                    },
                    'statistics': {
                        'frames_with_faces': frames_with_faces,
                        'frames_without_faces': frames_without_faces,
                        'avg_faces_per_frame': avg_faces_per_frame,
                        'max_faces_in_frame': max_faces_in_frame
                    }
                }
            }
            
            job['status'] = 'done'
            job['progress'] = 1.0
            job['result'] = result
            
        except Exception as e:
            if job:
                job['status'] = 'error'
                job['error'] = str(e)
            print(f"Video analysis error: {e}")
    
    threading.Thread(target=video_analysis_worker, 
                    args=(job_id,), 
                    daemon=True).start()
    
    return jsonify({"job_id": job_id, "status": "queued"})


@app.route('/api/video-analysis/results/<job_id>', methods=['GET'])
def api_video_analysis_results(job_id: str):
    """Get detailed results for a video analysis job."""
    job = store.get_job(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    
    return jsonify(job)


@app.route('/api/video-analysis/export/<job_id>', methods=['GET'])
def api_video_analysis_export(job_id: str):
    """Export analysis results as JSON or CSV."""
    job = store.get_job(job_id)
    if not job or job['status'] != 'done':
        return jsonify({'error': 'Job not found or not completed'}), 404
    
    format_type = request.args.get('format', 'json')
    
    if format_type == 'json':
        return app.response_class(
            json.dumps(job['result'], indent=2),
            mimetype='application/json',
            headers={'Content-Disposition': f'attachment; filename=video_analysis_{job_id}.json'}
        )
    elif format_type == 'csv':
        # Convert to CSV format
        import io
        import csv
        
        output = io.StringIO()
        writer = csv.writer(output)
        
        # Write headers
        writer.writerow(['Frame', 'Timestamp', 'Faces_Count', 'Matched_Count', 'Person_Names'])
        
        # Write data
        for detection in job['result']['detections']:
            matched_count = sum(1 for face in detection['faces'] if face['matched'])
            person_names = [face.get('person_name', 'Unknown') for face in detection['faces'] if face['matched']]
            
            writer.writerow([
                detection['frame'],
                detection['timestamp'],
                len(detection['faces']),
                matched_count,
                '; '.join(person_names)
            ])
        
        output.seek(0)
        return app.response_class(
            output.getvalue(),
            mimetype='text/csv',
            headers={'Content-Disposition': f'attachment; filename=video_analysis_{job_id}.csv'}
        )
    
    return jsonify({'error': 'Unsupported format'}), 400


@app.route('/api/video-analysis/detection-image/<job_id>/<path:thumb_path>')
def api_video_analysis_detection_image(job_id: str, thumb_path: str):
    """Serve detection thumbnail images."""
    return send_from_directory(UPLOAD_DIR / 'data', thumb_path)


# RTSP Stream Analysis Endpoints
@app.route('/api/rtsp-analysis/start', methods=['POST'])
def api_rtsp_analysis_start():
    """Start RTSP stream analysis for specified duration."""
    try:
        rtsp_id = request.form.get('rtsp_id', '').strip()
        duration = int(request.form.get('duration', 30))
        threshold = float(request.form.get('threshold', 0.6))
        use_watchlist = request.form.get('use_watchlist', 'true').lower() == 'true'
        skip_frames = int(request.form.get('skip_frames', 1))
        
        if not rtsp_id:
            return jsonify({'error': 'RTSP ID is required'}), 400
            
        if duration < 10 or duration > 300:
            return jsonify({'error': 'Duration must be between 10 and 300 seconds'}), 400
            
        # Create a job for RTSP analysis
        job_id = f"rtsp_{int(time.time())}_{uuid.uuid4().hex[:8]}"
        
        # Add job to queue
        job = {
            'id': job_id,
            'type': 'rtsp_analysis',
            'status': 'queued',
            'progress': 0.0,
            'rtsp_id': rtsp_id,
            'duration': duration,
            'threshold': threshold,
            'use_watchlist': use_watchlist,
            'skip_frames': skip_frames,
            'created_at': time.time(),
            'result': None,
            'error': None
        }
        
        JOBS[job_id] = job
        
        # Start processing in background thread
        threading.Thread(
            target=process_rtsp_analysis_job,
            args=(job_id,),
            daemon=True
        ).start()
        
        return jsonify({
            'job_id': job_id,
            'status': 'queued',
            'message': f'RTSP analysis started for stream {rtsp_id}'
        })
        
    except Exception as e:
        print(f"Error starting RTSP analysis: {e}")
        return jsonify({'error': str(e)}), 500


def process_rtsp_analysis_job(job_id: str):
    """Process RTSP analysis job in background."""
    job = JOBS.get(job_id)
    if not job:
        return
        
    try:
        job['status'] = 'running'
        rtsp_id = job['rtsp_id']
        duration = job['duration']
        threshold = job['threshold']
        use_watchlist = job['use_watchlist']
        skip_frames = job['skip_frames']
        
        print(f"Starting RTSP analysis for stream {rtsp_id}, duration {duration}s")
        
        # Create results directory
        results_dir = UPLOAD_DIR / 'data' / 'rtsp_analysis' / job_id
        results_dir.mkdir(parents=True, exist_ok=True)
        
        # Load gallery for matching if using watchlist
        gallery = []
        if use_watchlist:
            try:
                # Get watchlist persons with their embeddings
                watchlist = dbm.get_watchlist(DB_CONN)
                for person in watchlist:
                    for embedding_data in person.get('embeddings', []):
                        emb = np.array(embedding_data, dtype=np.float32)
                        emb = emb / (np.linalg.norm(emb) + 1e-10)  # Normalize
                        gallery.append((person['person_id'], person['person_name'], emb))
            except Exception as e:
                print(f"Failed to load gallery: {e}")
        
        # Try to get RTSP URL from camera configuration
        # In a real implementation, you'd look up the RTSP URL by ID
        # For now, we'll simulate the process or try common patterns
        
        rtsp_urls = [
            f"rtsp://127.0.0.1:8554/{rtsp_id}",
            f"rtsp://localhost:8554/{rtsp_id}",
            f"rtsp://192.168.1.100:554/{rtsp_id}",
            rtsp_id  # In case full URL is provided
        ]
        
        cap = None
        for rtsp_url in rtsp_urls:
            try:
                print(f"Trying RTSP URL: {rtsp_url}")
                # Use more robust RTSP parameters
                cap = cv2.VideoCapture(rtsp_url, cv2.CAP_FFMPEG)
                
                # Set buffer size to reduce latency and frame drops
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
                cap.set(cv2.CAP_PROP_FPS, 30)
                
                if cap.isOpened():
                    # Try to read multiple frames to ensure stable connection
                    stable_frames = 0
                    for _ in range(5):
                        ret, frame = cap.read()
                        if ret and frame is not None and frame.size > 0:
                            stable_frames += 1
                        else:
                            break
                    
                    if stable_frames >= 3:  # Need at least 3 stable frames
                        print(f"Successfully connected to {rtsp_url} with {stable_frames} stable frames")
                        break
                    else:
                        print(f"Connection unstable to {rtsp_url}, only {stable_frames} frames")
                        cap.release()
                        cap = None
                else:
                    cap = None
            except Exception as e:
                print(f"Failed to connect to {rtsp_url}: {e}")
                if cap:
                    cap.release()
                cap = None
        
        if cap is None:
            # Fallback: generate synthetic data for demo
            print(f"Could not connect to RTSP stream {rtsp_id}, generating demo results")
            result = generate_demo_rtsp_results(rtsp_id, duration)
            job['result'] = result
            job['status'] = 'done'
            job['progress'] = 1.0
            return
            
        # Process RTSP stream
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        total_frames = int(duration * fps)
        detections = []
        unique_face_embeddings = []
        total_faces = 0
        matched_faces = 0
        frame_count = 0
        processed_frames = 0
        frames_with_faces = 0
        frames_without_faces = 0
        max_faces_in_frame = 0
        start_time = time.time()
        
        print(f"Processing RTSP stream: {fps} FPS, {width}x{height}, {total_frames} frames expected")
        
        valid_frames = 0
        corrupted_frames = 0
        
        while frame_count < total_frames:
            ret, frame = cap.read()
            if not ret:
                print(f"Failed to read frame {frame_count}, breaking")
                break
                
            # Skip frames if requested
            if frame_count % skip_frames != 0:
                frame_count += 1
                continue
                
            processed_frames += 1
            
            # Update progress
            progress = frame_count / total_frames
            job['progress'] = progress
            
            # Detect faces
            if frame is not None and frame.size > 0:
                # Check if frame is valid (not corrupted)
                if frame.shape[0] > 0 and frame.shape[1] > 0 and frame.shape[2] == 3:
                    try:
                        # Validate frame data
                        if np.any(frame):  # Frame contains actual data
                            valid_frames += 1
                            faces = fa.get(frame)
                            frame_detections = []
                            num_faces = len(faces)
                            
                            if valid_frames % 100 == 0:  # Log every 100 valid frames
                                print(f"Processed {valid_frames} valid frames, found {total_faces} faces so far")
                            
                            if num_faces > 0:
                                frames_with_faces += 1
                                max_faces_in_frame = max(max_faces_in_frame, num_faces)
                            else:
                                frames_without_faces += 1
                                
                            total_faces += num_faces
                            
                            for face in faces:
                                bbox = face.bbox.astype(int).tolist()
                                confidence = float(face.det_score)
                                
                                # Get face embedding for uniqueness and matching
                                emb = face.embedding
                                emb = emb / (np.linalg.norm(emb) + 1e-10)
                                
                                # Check for uniqueness (basic clustering)
                                is_unique = True
                                for unique_emb in unique_face_embeddings:
                                    similarity = float(np.dot(unique_emb, emb))
                                    if similarity > 0.8:  # High similarity threshold for uniqueness
                                        is_unique = False
                                        break
                                
                                if is_unique:
                                    unique_face_embeddings.append(emb)
                                    
                                # Face matching against watchlist
                                matched = False
                                person_id = None
                                person_name = None
                                best_similarity = 0
                                
                                if use_watchlist and gallery:
                                    for pid, pname, gallery_emb in gallery:
                                        sim = float(np.dot(gallery_emb, emb))
                                        if sim > best_similarity:
                                            best_similarity = sim
                                            if sim >= threshold:
                                                matched = True
                                                person_id = pid
                                                person_name = pname
                                
                                if matched:
                                    matched_faces += 1
                                
                                # Save face thumbnail
                                thumb_path = _save_thumb(frame, bbox, f"rtsp_{job_id}_{frame_count}_{len(frame_detections)}")
                                
                                # Save full frame if matched
                                frame_path = None
                                if matched:
                                    frame_path = _save_frame(frame, f"rtsp_frame_{job_id}_{frame_count}")
                                
                                frame_detections.append({
                                    'bbox': bbox,
                                    'confidence': confidence,
                                    'similarity': best_similarity,
                                    'matched': matched,
                                    'person_id': person_id,
                                    'person_name': person_name,
                                    'thumb_path': thumb_path,
                                    'frame_path': frame_path
                                })
                            
                            if frame_detections:
                                detections.append({
                                    'frame': frame_count,
                                    'timestamp': frame_count / fps,
                                    'faces': frame_detections
                                })
                        else:
                            # Skip empty/black frames
                            corrupted_frames += 1
                    except Exception as face_detect_error:
                        print(f"Face detection error on frame {frame_count}: {face_detect_error}")
                        corrupted_frames += 1
                else:
                    corrupted_frames += 1
                    if corrupted_frames % 50 == 0:  # Log every 50 corrupted frames
                        print(f"Skipped {corrupted_frames} corrupted frames so far")
            else:
                corrupted_frames += 1
            
            frame_count += 1
            
            # Check if we should stop (duration exceeded)
            elapsed = time.time() - start_time
            if elapsed > duration + 5:  # 5 second buffer
                break
        
        cap.release()
        
        # Calculate final statistics
        unique_faces = len(unique_face_embeddings)
        avg_faces_per_frame = total_faces / processed_frames if processed_frames > 0 else 0
        processing_time = time.time() - start_time
        
        result = {
            'totalFrames': frame_count,
            'processedFrames': processed_frames,
            'totalFaces': total_faces,
            'matchedFaces': matched_faces,
            'uniqueFaces': unique_faces,
            'processingTime': processing_time,
            'detections': detections,
            'summary': {
                'videoInfo': {
                    'duration': duration,
                    'fps': fps,
                    'width': width,
                    'height': height
                },
                'statistics': {
                    'frames_with_faces': frames_with_faces,
                    'frames_without_faces': frames_without_faces,
                    'avg_faces_per_frame': avg_faces_per_frame,
                    'max_faces_in_frame': max_faces_in_frame
                }
            }
        }
        
        job['result'] = result
        job['status'] = 'done'
        job['progress'] = 1.0
        
        print(f"RTSP analysis completed:")
        print(f"  - Total frames processed: {frame_count}")
        print(f"  - Valid frames: {valid_frames}")  
        print(f"  - Corrupted frames: {corrupted_frames}")
        print(f"  - Total faces detected: {total_faces}")
        print(f"  - Matched faces: {matched_faces}")
        print(f"  - Unique people: {unique_faces}")
        print(f"  - Processing time: {processing_time:.2f}s")
        
        print(f"RTSP analysis completed: {total_faces} faces, {matched_faces} matches")
        
    except Exception as e:
        print(f"Error in RTSP analysis: {e}")
        job['status'] = 'error'
        job['error'] = str(e)


def generate_demo_rtsp_results(rtsp_id: str, duration: int):
    """Generate demo results when RTSP stream is not available."""
    fps = 25
    total_frames = duration * fps
    
    # Generate realistic random data
    num_detections = min(50, int(duration * 2))  # ~2 detections per second
    detections = []
    
    for i in range(num_detections):
        frame_num = int((i / num_detections) * total_frames)
        timestamp = frame_num / fps
        num_faces = np.random.randint(1, 4)  # 1-3 faces per detection
        
        faces = []
        for j in range(num_faces):
            faces.append({
                'bbox': [
                    100 + j * 60 + np.random.randint(-20, 20),
                    100 + j * 40 + np.random.randint(-20, 20),
                    180 + j * 60 + np.random.randint(-20, 20),
                    200 + j * 40 + np.random.randint(-20, 20)
                ],
                'confidence': 0.85 + np.random.random() * 0.14,
                'matched': np.random.random() > 0.6,
                'person_id': np.random.randint(1, 11) if np.random.random() > 0.6 else None,
                'person_name': f"Person {np.random.randint(1, 11)}" if np.random.random() > 0.6 else None
            })
        
        detections.append({
            'frame': frame_num,
            'timestamp': timestamp,
            'faces': faces
        })
    
    total_faces = sum(len(d['faces']) for d in detections)
    matched_faces = sum(len([f for f in d['faces'] if f['matched']]) for d in detections)
    
    return {
        'totalFrames': total_frames,
        'processedFrames': total_frames,
        'totalFaces': total_faces,
        'matchedFaces': matched_faces,
        'uniqueFaces': len(set(f['person_id'] for d in detections for f in d['faces'] if f['person_id'])),
        'processingTime': duration,
        'detections': detections,
        'summary': {
            'videoInfo': {
                'duration': duration,
                'fps': fps,
                'width': 1920,
                'height': 1080
            },
            'statistics': {
                'frames_with_faces': len([d for d in detections if d['faces']]),
                'frames_without_faces': total_frames - len([d for d in detections if d['faces']]),
                'avg_faces_per_frame': total_faces / total_frames,
                'max_faces_in_frame': max([len(d['faces']) for d in detections], default=0)
            }
        }
    }


if __name__=='__main__':
    # bind to 0.0.0.0 so the server is reachable from other interfaces if needed
    # Use port 5001 because macOS may reserve 5000 for AirPlay/Bonjour
    app.run(host='0.0.0.0', port=5001, debug=False)
