#!/usr/bin/env python3
"""Smoke test: run MizVa FaceAnalysis (detection + recognition) on a downloaded image.

This script downloads a sample face image and runs the rebranded MizVa interface.
It adjusts sys.path so it can be executed both as a script and as a module.
"""
import os
import sys
from pathlib import Path
import cv2
import numpy as np
from urllib.request import urlretrieve

# Ensure project root (two levels up) is on sys.path when running as a script
ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Import the shim that re-exports insightface FaceAnalysis
from mizva.mizva.app import FaceAnalysis

IMG_URL = 'https://raw.githubusercontent.com/opencv/opencv/master/samples/data/lena.jpg'
IMG_PATH = 'tmp_test.jpg'


def download_image():
    if not os.path.exists(IMG_PATH):
        print('Downloading sample image...')
        urlretrieve(IMG_URL, IMG_PATH)
    else:
        print('Using cached image', IMG_PATH)


def main():
    download_image()
    img = cv2.imread(IMG_PATH)
    if img is None:
        print('Failed to load image')
        sys.exit(1)

    print('Initializing FaceAnalysis...')
    fa = FaceAnalysis(allowed_modules=['detection','recognition'])
    fa.prepare(ctx_id=-1, det_size=(640,640))

    print('Running analysis...')
    faces = fa.get(img)
    print('Detected faces:', len(faces))
    for i,face in enumerate(faces):
        bbox = face.bbox.astype(int).tolist()
        print(f'Face {i}: bbox={bbox}, prob={face.det_score:.3f}')
        emb = face.embedding
        if emb is not None:
            print(f' embedding len={len(emb)}, norm={np.linalg.norm(emb):.4f}')
        x1,y1,x2,y2 = bbox
        crop = img[y1:y2, x1:x2]
        cv2.imwrite(f'face_{i}.jpg', crop)
        print(f' cropped face_{i}.jpg')


if __name__ == '__main__':
    main()
