"""Minimal TFLite embedding + matching demo.

This demo expects a TFLite embedding model that takes an aligned face crop and
returns a 128/256/512-d embedding.

Usage:
    python3 tflite_inference_demo.py --model arcface_mobile.tflite --image face.jpg

"""
import argparse
import numpy as np
from PIL import Image
import tensorflow as tf


def load_image(path, size=(112,112)):
    img = Image.open(path).convert('RGB')
    img = img.resize(size)
    arr = np.asarray(img).astype(np.float32)
    # normalize: adapt to your model's expected preprocessing (example: [0,1])
    arr = (arr - 127.5) / 128.0
    return arr


def run_tflite(model_path, input_image):
    interp = tf.lite.Interpreter(model_path=model_path)
    interp.allocate_tensors()
    input_details = interp.get_input_details()
    output_details = interp.get_output_details()

    inp = input_image[np.newaxis, ...].astype(input_details[0]['dtype'])
    interp.set_tensor(input_details[0]['index'], inp)
    interp.invoke()
    out = interp.get_tensor(output_details[0]['index'])
    return out[0]


def normalize(emb):
    emb = emb / (np.linalg.norm(emb) + 1e-10)
    return emb


def cosine(a,b):
    return float(np.dot(a,b)/(np.linalg.norm(a)*np.linalg.norm(b)+1e-10))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', required=True)
    parser.add_argument('--image', required=True)
    parser.add_argument('--known', nargs='*', help='paths to known images')
    args = parser.parse_args()

    img = load_image(args.image)
    emb = run_tflite(args.model, img)
    emb = normalize(emb)
    print('Embedding length:', emb.shape)

    if args.known:
        known_embs = []
        for k in args.known:
            ki = load_image(k)
            ke = run_tflite(args.model, ki)
            known_embs.append(normalize(ke))
        for i,ke in enumerate(known_embs):
            print('cosine with', args.known[i], cosine(emb, ke))

    # Example threshold (tune for your model): 0.38-0.5 depending on embedding dim
    
