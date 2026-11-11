#!/usr/bin/env python3
"""Research-only corner regression on frozen pretrained Open Images features.

Not a production model: uses provisional labels and a previously reused test
set. Image data and generated model must remain outside the public repository.
"""
import argparse
import hashlib
import io
import json
import os
import tempfile
import zipfile
from pathlib import Path

os.environ['ORT_DISABLE_TELEMETRY'] = '1'
import numpy as np
import onnx
import onnxruntime as ort
from onnx import TensorProto, helper, numpy_helper
from PIL import Image

INPUT = 'hub_input/image_tensor:0'
FEATURE = 'FeatureExtractor/MobilenetV2/expanded_conv_15/add:0'
SOURCE_HASH = '9f80310593a35585d2e3c4681f5afed7a4a9c1b548977a46305ccf61387eccd6'


def flip_corners(points):
    out = np.asarray(points, dtype=np.float32)[[1, 0, 3, 2]].copy()
    out[:, 0] = 1 - out[:, 0]
    return out


def ridge_head(x, y, penalty):
    x, y = np.asarray(x, dtype=np.float64), np.asarray(y, dtype=np.float64)
    xm, ym = x.mean(axis=0), y.mean(axis=0)
    centered = x - xm
    weights = centered.T @ np.linalg.solve(centered @ centered.T + penalty*np.eye(len(x)), y-ym)
    return weights, ym - xm @ weights


def diagonal_error(predicted, truth, width, height):
    delta = (np.asarray(predicted) - np.asarray(truth)) * [width, height]
    return float(np.mean(np.linalg.norm(delta, axis=1)) / np.hypot(width, height))


def tensor(raw, flip=False):
    with Image.open(io.BytesIO(raw)) as im:
        im = im.convert('RGB')
        if flip:
            im = im.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        im = im.resize((300, 300), Image.Resampling.BILINEAR)
        return np.asarray(im, dtype=np.float32)[None] / 255.


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--model', required=True, type=Path)
    ap.add_argument('--dataset', required=True, type=Path)
    ap.add_argument('--output', required=True, type=Path)
    args = ap.parse_args()
    sha = hashlib.sha256(args.model.read_bytes()).hexdigest()
    if sha != SOURCE_HASH:
        raise ValueError('pretrained detector hash mismatch')
    ort.disable_telemetry_events()
    opts = ort.SessionOptions()
    opts.intra_op_num_threads = 2
    opts.inter_op_num_threads = 1
    args.output.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        backbone_path = str(Path(tmp) / 'backbone.onnx')
        backbone = onnx.load(str(args.model))
        del backbone.graph.output[:]
        backbone.graph.output.extend([helper.make_tensor_value_info(FEATURE, TensorProto.FLOAT, [1, 160, 10, 10])])
        onnx.checker.check_model(backbone)
        onnx.save(backbone, backbone_path)
        session = ort.InferenceSession(backbone_path, opts, providers=['CPUExecutionProvider'])
        data = {}
        samples = {}
        with zipfile.ZipFile(args.dataset) as archive:
            for split in ('train', 'val', 'test'):
                rows = json.loads(archive.read(f'exports/{split}_corners.json'))
                features, labels, names, sizes = [], [], [], []
                for row in rows:
                    raw = archive.read('images/' + row['file'])
                    target = np.asarray(row['quad_xy_tl_tr_br_bl'], dtype=np.float32) / [row['width'], row['height']]
                    for flip in ((False, True) if split == 'train' else (False,)):
                        sample = tensor(raw, flip)
                        feature = session.run([FEATURE], {INPUT: sample})[0].reshape(-1)
                        features.append(feature)
                        labels.append((flip_corners(target) if flip else target).reshape(-1))
                        names.append(row['file'])
                        sizes.append([row['width'], row['height']])
                        if split == 'val' and not samples:
                            samples = {'input': sample, 'feature': feature}
                data[split] = (np.asarray(features), np.asarray(labels), names, sizes)
        x, y, _, _ = data['train']
        # Fixed before evaluation. Scale prevents feature magnitude from defining lambda.
        scale = float(np.sqrt(np.mean(x.astype(np.float64)**2)))
        w, b = ridge_head(x / scale, y, penalty=100.0)
        w, b = (w / scale).astype(np.float32), b.astype(np.float32)
        model = onnx.load(backbone_path)
        del model.graph.output[:]
        model.graph.node.extend([
            helper.make_node('Flatten', [FEATURE], ['corner_flat'], axis=1),
            helper.make_node('MatMul', ['corner_flat', 'corner_weights'], ['corner_linear']),
            helper.make_node('Add', ['corner_linear', 'corner_bias'], ['corner_normalized'])])
        model.graph.initializer.extend([numpy_helper.from_array(w, 'corner_weights'), numpy_helper.from_array(b, 'corner_bias')])
        model.graph.output.extend([helper.make_tensor_value_info('corner_normalized', TensorProto.FLOAT, [1, 8])])
        model.doc_string = 'RESEARCH ONLY: pretrained Google features; provisional doorway labels; not validated for placement.'
        onnx.checker.check_model(model)
        output_model = args.output / 'corner_pretrained_probe_research.onnx'
        onnx.save(model, str(output_model))
        check = ort.InferenceSession(str(output_model), opts, providers=['CPUExecutionProvider'])
        actual = check.run(None, {INPUT: samples['input']})[0].reshape(-1)
        expected = samples['feature'] @ w + b
        np.testing.assert_allclose(actual, expected, rtol=1e-4, atol=1e-4)
        results = {}
        for split in ('train', 'val', 'test'):
            features, labels, names, sizes = data[split]
            predicted = features @ w + b
            errors = [diagonal_error(p.reshape(4,2), t.reshape(4,2), *size)
                      for p, t, size in zip(predicted, labels, sizes)]
            point_errors = np.concatenate([
                np.linalg.norm((p.reshape(4,2)-t.reshape(4,2))*size, axis=1) / np.hypot(*size)
                for p, t, size in zip(predicted, labels, sizes)])
            results[split] = {'images': len(names), 'mean_image_corner_error_fraction': float(np.mean(errors)),
                              'median_image_corner_error_fraction': float(np.median(errors)),
                              'median_individual_corner_error_fraction': float(np.median(point_errors)),
                              'per_image': [{'file': n, 'mean_error_fraction': e} for n,e in zip(names,errors)]}
        report = {'scope': 'research only; provisional labels; reused holdout; no placement approval',
                  'architecture': 'frozen pretrained Google MobileNet features plus fitted ridge corner head',
                  'detector_changed': False, 'real_photo_training': True,
                  'training_photos': len(data['train'][2])//2, 'training_samples_with_flips': len(x),
                  'ridge_penalty': 100.0, 'source_sha256': sha,
                  'dataset_sha256': hashlib.sha256(args.dataset.read_bytes()).hexdigest(),
                  'onnx_sha256': hashlib.sha256(output_model.read_bytes()).hexdigest(),
                  'onnx_parity_max_error': float(np.max(np.abs(actual-expected))), 'splits': results}
        (args.output / 'report.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
