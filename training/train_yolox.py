#!/usr/bin/env python3
"""Gated YOLOX-Nano fine-tuning. Boxes are candidates, never installation corners."""
import argparse
import json
from pathlib import Path
import random
import shutil
import subprocess
import sys

import cv2
import numpy as np

from yolox_dataset import check_training_rights, file_sha256, load_bundle
from yolox_preflight import UPSTREAM_COMMIT, verify_checkpoint


def prepare_sample(bgr, sample, size=416):
    height, width = bgr.shape[:2]
    scale = min(size / height, size / width)
    scaled_width, scaled_height = max(1, int(width * scale)), max(1, int(height * scale))
    image = np.full((size, size, 3), 114, dtype=np.uint8)
    image[:scaled_height, :scaled_width] = cv2.resize(bgr, (scaled_width, scaled_height))
    labels = []
    for obj in sample['objects']:
        x, y, w, h = obj['bbox_xywh']
        labels.append([obj['class_id'], (x + w / 2) * scale, (y + h / 2) * scale,
                       w * scale, h * scale])
    return (np.ascontiguousarray(image.transpose(2, 0, 1), dtype=np.float32),
            np.asarray(labels, dtype=np.float32).reshape(-1, 5), scale)


def match_predictions(predictions, truth, iou_threshold=0.5):
    matched = set()
    tp = 0
    for prediction in sorted(predictions, key=lambda p: p['score'], reverse=True):
        px1, py1, px2, py2 = prediction['bbox_xyxy']
        best_index, best_iou = None, 0
        for index, obj in enumerate(truth):
            if index in matched or prediction['class_id'] != obj['class_id']:
                continue
            x, y, w, h = obj['bbox_xywh']
            intersection = max(0, min(px2, x + w) - max(px1, x)) * max(0, min(py2, y + h) - max(py1, y))
            union = max(0, px2 - px1) * max(0, py2 - py1) + w * h - intersection
            iou = intersection / union if union > 0 else 0
            if iou > best_iou:
                best_index, best_iou = index, iou
        if best_index is not None and best_iou >= iou_threshold:
            matched.add(best_index)
            tp += 1
    return {'tp': tp, 'fp': len(predictions) - tp, 'fn': len(truth) - tp}


def build_pretrained_model(upstream, checkpoint, num_classes):
    import torch
    upstream = Path(upstream).resolve()
    revision = subprocess.check_output(['git', '-C', str(upstream), 'rev-parse', 'HEAD'], text=True).strip()
    if revision != UPSTREAM_COMMIT:
        raise ValueError('Unpinned YOLOX upstream revision')
    subprocess.run(['git', '-C', str(upstream), 'diff', '--quiet', 'HEAD'], check=True)
    checkpoint = verify_checkpoint(checkpoint)
    sys.path.insert(0, str(upstream))
    from yolox.exp import get_exp
    exp = get_exp(exp_file=str(upstream / 'exps/default/yolox_nano.py'))
    exp.num_classes = num_classes
    model = exp.get_model()
    original = torch.load(checkpoint, map_location='cpu', weights_only=True)['model']
    current = model.state_dict()
    # COCO class semantics never carry over to custom door/window categories.
    classifiers = {key for key in current if key.startswith('head.cls_preds.')}
    transferable = {}
    for key, tensor in current.items():
        if key in classifiers:
            continue
        if key not in original or original[key].shape != tensor.shape:
            raise ValueError(f'Pretrained non-classification tensor mismatch: {key}')
        transferable[key] = original[key]
    extra = set(original) - set(current)
    if extra:
        raise ValueError(f'Unexpected pretrained tensors: {sorted(extra)}')
    result = model.load_state_dict(transferable, strict=False)
    if set(result.missing_keys) != classifiers or result.unexpected_keys:
        raise ValueError('Incomplete pretrained transfer')
    return model, {'transferred_tensors': len(transferable),
                   'reinitialized_classification_tensors': sorted(classifiers)}


def batches(samples, batch_size, rng):
    import torch
    ordered = list(samples)
    rng.shuffle(ordered)
    for offset in range(0, len(ordered), batch_size):
        prepared = []
        for sample in ordered[offset:offset + batch_size]:
            bgr = cv2.imread(sample['path'])
            if bgr is None:
                raise ValueError(f'Cannot decode {sample["file"]}')
            prepared.append(prepare_sample(bgr, sample))
        # Dynamic padding retains every annotated object, including >50 instances.
        max_objects = max(1, max(len(labels) for _, labels, _ in prepared))
        targets = np.zeros((len(prepared), max_objects, 5), dtype=np.float32)
        for index, (_, labels, _) in enumerate(prepared):
            targets[index, :len(labels)] = labels
        yield torch.from_numpy(np.stack([image for image, _, _ in prepared])), torch.from_numpy(targets)


def evaluate(model, samples, num_classes, device, score_threshold, nms_threshold):
    import torch
    from yolox.utils import postprocess
    model.eval()
    counts = {'tp': 0, 'fp': 0, 'fn': 0}
    per_class = {str(i): {'name': name, 'tp': 0, 'fp': 0, 'fn': 0}
                 for i, name in enumerate(num_classes)}
    negative_images = negative_images_with_detections = 0
    with torch.inference_mode():
        for sample in samples:
            bgr = cv2.imread(sample['path'])
            if bgr is None:
                raise ValueError(f'Cannot decode {sample["file"]}')
            image, _, scale = prepare_sample(bgr, sample)
            raw = model(torch.from_numpy(image).unsqueeze(0).to(device))
            if not torch.isfinite(raw).all().item():
                raise ValueError('Nonfinite validation output')
            output = postprocess(raw, len(num_classes), score_threshold, nms_threshold,
                                 class_agnostic=False)[0]
            predictions = []
            if output is not None:
                for row in output.cpu().tolist():
                    box = [max(0, min(value / scale, sample['width'] if i % 2 == 0 else sample['height']))
                           for i, value in enumerate(row[:4])]
                    predictions.append({'bbox_xyxy': box, 'class_id': int(row[6]), 'score': row[4] * row[5]})
            result = match_predictions(predictions, sample['objects'])
            for key in counts:
                counts[key] += result[key]
            for category, totals in per_class.items():
                cid = int(category)
                result = match_predictions([p for p in predictions if p['class_id'] == cid],
                                           [o for o in sample['objects'] if o['class_id'] == cid])
                for key in counts:
                    totals[key] += result[key]
            if not sample['objects']:
                negative_images += 1
                negative_images_with_detections += bool(predictions)
    for totals in [counts, *per_class.values()]:
        totals['precision'] = totals['tp'] / (totals['tp'] + totals['fp']) if totals['tp'] + totals['fp'] else None
        totals['recall'] = totals['tp'] / (totals['tp'] + totals['fn']) if totals['tp'] + totals['fn'] else None
    return {**counts, 'per_class': per_class, 'negative_images': negative_images,
            'negative_images_with_detections': negative_images_with_detections,
            'score_threshold': score_threshold, 'nms_threshold': nms_threshold, 'iou_threshold': 0.5,
            'split': 'validation', 'blind_test_evaluated': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for flag in ('dataset', 'images', 'upstream', 'checkpoint', 'rights', 'output'):
        parser.add_argument('--' + flag, type=Path, required=True)
    parser.add_argument('--epochs', type=int, default=20)
    parser.add_argument('--batch-size', type=int, default=2)
    parser.add_argument('--learning-rate', type=float, default=1e-4)
    parser.add_argument('--score-threshold', type=float, default=0.25)
    parser.add_argument('--nms-threshold', type=float, default=0.45)
    parser.add_argument('--device', choices=('cpu', 'cuda'), default='cpu')
    parser.add_argument('--seed', type=int, default=20261111)
    args = parser.parse_args()
    if args.epochs < 1 or args.batch_size < 1 or not 0 < args.learning_rate < 1:
        parser.error('Invalid epochs, batch size or learning rate')
    if not (0 < args.score_threshold < 1 and 0 < args.nms_threshold < 1):
        parser.error('Thresholds must be in (0, 1)')
    # Fail before loading model, allocating GPU or writing any output artifacts.
    bundle = load_bundle(args.dataset, args.images)
    rights = json.loads(args.rights.read_text())
    digest = file_sha256(verify_checkpoint(args.checkpoint))
    check_training_rights(rights, digest, bundle['dataset_sha256'])
    if args.output.exists() and any(args.output.iterdir()):
        raise ValueError('Output directory must be empty; preserve prior experiment artifacts')
    import torch
    if args.device == 'cuda' and not torch.cuda.is_available():
        raise ValueError('CUDA requested but unavailable; no silent CPU fallback')
    random.seed(args.seed); np.random.seed(args.seed); torch.manual_seed(args.seed)
    torch.set_num_threads(2)
    torch.use_deterministic_algorithms(True)
    model, transfer = build_pretrained_model(args.upstream, args.checkpoint, len(bundle['classes']))
    model.to(args.device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.learning_rate, weight_decay=1e-4)
    repository = Path(__file__).resolve().parent.parent
    training_revision = subprocess.check_output(
        ['git', '-C', str(repository), 'rev-parse', 'HEAD'], text=True).strip()
    training_dirty = bool(subprocess.check_output(
        ['git', '-C', str(repository), 'status', '--porcelain'], text=True).strip())
    source_files = [Path(__file__), Path(__file__).with_name('yolox_dataset.py'),
                    Path(__file__).with_name('yolox_preflight.py'),
                    Path(__file__).with_name('requirements-yolox-preflight.txt')]
    report = {'status': 'TRAINING_EXPERIMENT', 'production_ready': False,
              'classes': bundle['classes'], 'seed': args.seed, 'input_size': [416, 416],
              'preprocessing': 'BGR float32 0..255; upper-left letterbox value 114',
              'coordinate_target': 'detector boxes only; not placement corners',
              'upstream_commit': UPSTREAM_COMMIT, 'checkpoint_sha256': digest,
              'training_repository_commit': training_revision,
              'training_repository_dirty': training_dirty,
              'training_source_hashes': {path.name: file_sha256(path) for path in source_files},
              'dataset_sha256': bundle['dataset_sha256'],
              'dataset_source_hashes': bundle['source_hashes'], 'transfer': transfer,
              'split_counts': {key: len(value) for key, value in bundle['splits'].items()},
              'parameters': {key: str(value) if isinstance(value, Path) else value
                             for key, value in vars(args).items()},
              'torch_version': torch.__version__, 'history': []}
    args.output.mkdir(parents=True, exist_ok=True)
    source_snapshot = args.output / 'training_sources'
    source_snapshot.mkdir()
    for source in source_files:
        shutil.copy2(source, source_snapshot / source.name)
    (args.output / 'input_manifest.json').write_text(json.dumps(bundle, indent=2))
    (args.output / 'rights_record.json').write_text(json.dumps(rights, indent=2))
    rng = random.Random(args.seed)
    for epoch in range(args.epochs):
        model.train(); total = 0.; steps = 0
        for images, targets in batches(bundle['splits']['train'], args.batch_size, rng):
            optimizer.zero_grad()
            losses = model(images.to(args.device), targets.to(args.device))
            loss = losses['total_loss']
            if not torch.isfinite(loss).item():
                raise ValueError('Nonfinite training loss; experiment aborted')
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 10., error_if_nonfinite=True)
            optimizer.step()
            total += loss.item(); steps += 1
        metrics = evaluate(model, bundle['splits']['val'], bundle['classes'], args.device,
                           args.score_threshold, args.nms_threshold)
        report['history'].append({'epoch': epoch + 1, 'train_loss': total / steps, 'validation': metrics})
        torch.save({'model': model.state_dict(), 'optimizer': optimizer.state_dict(),
                    'epoch': epoch + 1, 'classes': bundle['classes'], 'metadata': report},
                   args.output / 'last_checkpoint.pth')
        (args.output / 'training_report.json').write_text(json.dumps(report, indent=2) + '\n')
        print(json.dumps(report['history'][-1]), flush=True)
    checkpoint_path = args.output / 'last_checkpoint.pth'
    (args.output / 'checkpoint.sha256').write_text(file_sha256(checkpoint_path) + '\n')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, FileNotFoundError) as error:
        raise SystemExit('STOP: ' + str(error))
