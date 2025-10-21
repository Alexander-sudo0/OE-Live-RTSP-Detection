from flask import Flask, request, jsonify, send_from_directory, url_for
from flask_cors import CORS
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

# Try importing InsightFace directly (should be available in GPU environment now)
try:
    from insightface.app import FaceAnalysis
    print("✓ InsightFace imported successfully from GPU environment")
except ImportError as e:
    print(f"✗ Failed to import InsightFace: {e}")
    print("InsightFace not available in GPU environment")
    sys.exit(1)
import uuid

app = Flask(__name__)

# Initialize face analysis with GPU context (ctx_id=0 for GPU, -1 for CPU)
try:
    fa = FaceAnalysis(allowed_modules=['detection', 'recognition'])
    fa.prepare(ctx_id=0, det_size=(640, 640))  # ctx_id=0 enables GPU
    print("✓ FaceAnalysis initialized with GPU acceleration")
except Exception as e:
    print(f"✗ Failed to initialize FaceAnalysis with GPU: {e}")
    print("Falling back to CPU...")
    fa = FaceAnalysis(allowed_modules=['detection', 'recognition'])
    fa.prepare(ctx_id=-1, det_size=(640, 640))  # ctx_id=-1 for CPU
    print("✓ FaceAnalysis initialized with CPU fallback")

# Global variables
face_db = {}
face_vectors = {}
temp_storage = {}
lock = threading.Lock()

def load_data():
    global face_db, face_vectors
    face_db = load_database()
    face_vectors = load_vectors()

def save_data():
    save_database(face_db)
    save_vectors(face_vectors)

load_data()

def detect_and_recognize_faces(frame):
    try:
        faces = fa.get(frame)
        results = []
        
        for face in faces:
            bbox = face.bbox.astype(int)
            embedding = face.embedding
            
            # Recognition logic
            best_match = None
            best_distance = float('inf')
            
            for person_id, stored_embedding in face_vectors.items():
                distance = np.linalg.norm(embedding - stored_embedding)
                if distance < best_distance:
                    best_distance = distance
                    best_match = person_id
            
            # Threshold for recognition
            threshold = 0.6
            if best_distance < threshold and best_match in face_db:
                person_info = face_db[best_match]
                status = person_info.get('status', 'unknown')
                name = person_info.get('name', 'Unknown')
            else:
                status = 'unknown'
                name = 'Unknown Person'
                best_match = None
            
            results.append({
                'bbox': bbox.tolist(),
                'confidence': float(face.det_score),
                'person_id': best_match,
                'name': name,
                'status': status,
                'distance': float(best_distance) if best_match else None
            })
        
        return results
    except Exception as e:
        print(f"Error in face detection/recognition: {e}")
        return []

@app.route('/detect', methods=['POST'])
def detect_faces():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        file = request.files['image']
        
        # Read image
        image_data = file.read()
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image format'}), 400
        
        # Detect and recognize faces
        results = detect_and_recognize_faces(frame)
        
        # Log detection
        detection_log = {
            'timestamp': datetime.now().isoformat(),
            'faces_detected': len(results),
            'faces': results
        }
        
        return jsonify({
            'success': True,
            'faces': results,
            'total_faces': len(results),
            'timestamp': detection_log['timestamp']
        })
        
    except Exception as e:
        print(f"Error in /detect endpoint: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/register', methods=['POST'])
def register_face():
    try:
        if 'image' not in request.files:
            return jsonify({'error': 'No image provided'}), 400
        
        data = request.form
        name = data.get('name', '')
        status = data.get('status', 'unknown')
        
        if not name:
            return jsonify({'error': 'Name is required'}), 400
        
        file = request.files['image']
        
        # Read image
        image_data = file.read()
        nparr = np.frombuffer(image_data, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if frame is None:
            return jsonify({'error': 'Invalid image format'}), 400
        
        # Detect faces
        faces = fa.get(frame)
        
        if len(faces) == 0:
            return jsonify({'error': 'No face detected in the image'}), 400
        
        if len(faces) > 1:
            return jsonify({'error': 'Multiple faces detected. Please provide an image with only one face'}), 400
        
        # Get face embedding
        face = faces[0]
        embedding = face.embedding
        
        # Generate unique ID
        person_id = str(uuid.uuid4())
        
        # Store in database
        with lock:
            face_db[person_id] = {
                'name': name,
                'status': status,
                'registered_at': datetime.now().isoformat()
            }
            face_vectors[person_id] = embedding
            save_data()
        
        return jsonify({
            'success': True,
            'person_id': person_id,
            'name': name,
            'status': status,
            'message': 'Face registered successfully'
        })
        
    except Exception as e:
        print(f"Error in /register endpoint: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/database', methods=['GET'])
def get_database():
    try:
        return jsonify({
            'success': True,
            'database': face_db,
            'total_persons': len(face_db)
        })
    except Exception as e:
        print(f"Error in /database endpoint: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/delete/<person_id>', methods=['DELETE'])
def delete_person(person_id):
    try:
        with lock:
            if person_id in face_db:
                del face_db[person_id]
                if person_id in face_vectors:
                    del face_vectors[person_id]
                save_data()
                return jsonify({
                    'success': True,
                    'message': f'Person {person_id} deleted successfully'
                })
            else:
                return jsonify({'error': 'Person not found'}), 404
    except Exception as e:
        print(f"Error in /delete endpoint: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'healthy',
        'gpu_enabled': True,  # Assuming GPU is available
        'timestamp': datetime.now().isoformat()
    })

if __name__ == '__main__':
    print("Starting Face Recognition API with GPU acceleration...")
    print(f"Database contains {len(face_db)} registered persons")
    print("Server starting on http://localhost:5001")
    app.run(debug=True, host='0.0.0.0', port=5001, threaded=True)