Objective

Assemble MizVa components into a mobile (Android APK) face recognition + liveness pipeline. This repo contains conversion and demo helpers and a recommended integration approach using MediaPipe + TFLite.

Assumptions

- Target runtime: Android (APK) using TFLite interpreter with NNAPI/GPU delegates where available.
- We'll use MizVa model resources for: SCRFD (detection), a lightweight ArcFace/MobileFaceNet embedding model, and a small FAS/liveness classifier or MediaPipe landmark-based blink check.
- You have Python 3.8+ on your dev machine for conversion scripts.

Checklist (requirements)

- High accuracy FR: pick ArcFace variants from the MizVa model collection (MobileFaceNet / small iResNet).  ✅ Recommended
- Liveness: use a lightweight FAS model OR MediaPipe face‑mesh blink/motion checks.  ✅ Option: MediaPipe (fast) or TFLite FAS model
- ARM / mobile: deploy via TFLite or ONNXRuntime Mobile / NNAPI.  ✅ TFLite recommended for Android
- Very fast: choose lightweight backbones + quantize + NNAPI/GPU delegate.  ✅ Guidance provided

What’s in this folder

- `scripts/convert_onx_to_tflite.py` — template script: convert an ONNX model to a TFLite SavedModel then to TFLite (float16/int8 options). Requires `onnx`, `onnx-tf`, and `tensorflow`.
- `scripts/tflite_inference_demo.py` — minimal Python demo showing TFLite embedding inference and matching logic.

Quick high-level pipeline (recommended)

1. Detection: SCRFD (fast, accurate) -> returns face boxes.
2. Alignment: use landmarks (from SCRFD/MediaPipe face mesh) to align crop to canonical pose.
3. Embedding: ArcFace Mobile model (MobileFaceNet / small iResNet) in TFLite -> 512-D or 256-D embedding.
4. Matching: cosine distance against precomputed embeddings (store known embeddings on device).
5. Liveness: either
   - run a small TFLite FAS classifier on the face crop (recommended for stronger anti-spoofing), or
   - run MediaPipe face-mesh blink & motion heuristics (very fast, simpler).

Integration options for Android

- MediaPipe graph (recommended if you want native fast detection/landmarks). Inside MediaPipe graph call a custom calculator that runs the TFLite ArcFace embedding model and (optionally) FAS model.
- Or: Use CameraX -> process frames in a background thread -> TFLite interpreter for SCRFD and embedding. Use NNAPI/GPU delegate for speed.

Performance tips

- Use MobileFaceNet / MobileNet-backbone ArcFace variants (smaller FLOPs).
- Convert to float16 TFLite or int8 quantized model; test accuracy after quantization.
- Use NNAPI delegate on Android or GPU delegate where supported.
- Precompute and store known embeddings; do matching in float32 on-device.
- Keep detection at native resolution (e.g., 640x480) and run embedding only on detected faces.

Next steps I can do

- Create conversion & inference scripts and a minimal Android sample (MediaPipe or CameraX + TFLite) that runs detection -> embedding -> matching -> liveness and produces a debug overlay.
- Or produce step-by-step terminal commands for you to run on your machine.

If you want me to continue, pick one of the following:

1) Generate the conversion & demo scripts (I can do this now).  
2) I scaffold a minimal Android sample project (MediaPipe-based) and wire the TFLite models (larger task).  

If you pick (1) I will create the conversion and demo scripts and run a quick smoke check locally (on mac M1 if available). If you pick (2) I will scaffold an Android project and show build/run steps.
