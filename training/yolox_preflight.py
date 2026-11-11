#!/usr/bin/env python3
"""Research-only official YOLOX-Nano checkpoint and CPU inference preflight.
No training, door-detection accuracy or commercial license clearance is implied.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time

UPSTREAM_COMMIT = '6ddff4824372906469a7fae2dc3206c7aa4bbaee'
CHECKPOINT_SHA256 = 'cd28f55fbbc1829f99d9ac9b38a16d259a22889739c8728ea877610201feff7b'
CHECKPOINT_URL = 'https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.pth'


def verify_checkpoint(path, expected_sha256=CHECKPOINT_SHA256):
    path = Path(path)
    with path.open('rb') as stream:
        actual = hashlib.file_digest(stream, 'sha256').hexdigest()
    if actual != expected_sha256:
        raise ValueError(f'SHA256 mismatch: {actual}')
    return path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--upstream', type=Path, required=True)
    parser.add_argument('--checkpoint', type=Path, required=True)
    parser.add_argument('--report', type=Path, required=True)
    args = parser.parse_args()
    upstream = args.upstream.resolve()
    revision = subprocess.check_output(['git', '-C', str(upstream), 'rev-parse', 'HEAD'], text=True).strip()
    if revision != UPSTREAM_COMMIT:
        raise SystemExit('STOP: upstream revision differs from audited pin')
    checkpoint = verify_checkpoint(args.checkpoint)
    # Load the official experiment directly: its package alias is installed only by setup.py.
    sys.path.insert(0, str(upstream))
    import torch
    from yolox.exp import get_exp
    torch.set_num_threads(2)
    exp = get_exp(exp_file=str(upstream / 'exps/default/yolox_nano.py'))
    model = exp.get_model().cpu().eval()
    weights = torch.load(checkpoint, map_location='cpu', weights_only=True)
    model.load_state_dict(weights['model'], strict=True)
    sample = torch.zeros((1, 3, 416, 416), dtype=torch.float32)
    with torch.inference_mode():
        start = time.perf_counter()
        prediction = model(sample)
        elapsed = (time.perf_counter() - start) * 1000
    if tuple(prediction.shape) != (1, 3549, 85) or not torch.isfinite(prediction).all().item():
        raise RuntimeError('Unexpected or nonfinite raw COCO prediction')
    report = {
        'status': 'PRETRAINED_CPU_SMOKE_PASSED',
        'upstream_commit': revision, 'checkpoint_url': CHECKPOINT_URL,
        'checkpoint_sha256': CHECKPOINT_SHA256,
        'torch_version': torch.__version__, 'device': 'cpu',
        'input_shape': list(sample.shape), 'output_shape': list(prediction.shape),
        'first_forward_ms': round(elapsed, 2),
        'door_trained': False, 'commercial_weights_clearance': 'PENDING',
        'browser_benchmark': False,
        'scope': 'Synthetic input proves checkpoint loads and computes; not detection accuracy.',
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
