"""Template: convert ONNX to TFLite via TF SavedModel.

Usage notes:
- Install: pip install onnx onnx-tf tensorflow numpy
- Some ONNX models need custom pre/post processing; adapt this script accordingly.

This script does NOT fetch models automatically. Download SCRFD/ArcFace ONNX models from MizVa model sources or other sources.
"""
import os
import argparse
import numpy as np
import onnx
from onnx_tf.backend import prepare
import tensorflow as tf


def onnx_to_savedmodel(onnx_path, saved_model_dir):
    onnx_model = onnx.load(onnx_path)
    tf_rep = prepare(onnx_model)
    tf_rep.export_graph(saved_model_dir)


def savedmodel_to_tflite(saved_model_dir, tflite_path, quantize=None):
    converter = tf.lite.TFLiteConverter.from_saved_model(saved_model_dir)
    if quantize == 'float16':
        converter.target_spec.supported_types = [tf.float16]
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
    elif quantize == 'int8':
        # Full int8 requires representative dataset
        converter.optimizations = [tf.lite.Optimize.DEFAULT]
        # User must provide representative_dataset_generator
        raise NotImplementedError('int8 quantization requires a representative dataset')
    tflite_model = converter.convert()
    with open(tflite_path, 'wb') as f:
        f.write(tflite_model)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--onnx', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--temp', default='tmp_saved_model')
    parser.add_argument('--quantize', choices=['float16','int8',None], default=None)
    args = parser.parse_args()

    os.makedirs(args.temp, exist_ok=True)
    print('Converting', args.onnx, '->', args.temp)
    onnx_to_savedmodel(args.onnx, args.temp)
    print('SavedModel created at', args.temp)
    print('Converting SavedModel -> TFLite', args.out)
    savedmodel_to_tflite(args.temp, args.out, quantize=args.quantize)
    print('Done')
