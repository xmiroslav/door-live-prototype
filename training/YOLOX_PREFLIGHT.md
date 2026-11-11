# YOLOX-Nano executable preflight — 2026-11-11

## Done / tested

- Official checkpoint downloaded successfully (7,694,953 bytes; see checksum in report).
- Upstream pinned to `6ddff4824372906469a7fae2dc3206c7aa4bbaee`.
- `torch.load(weights_only=True)`, strict state-dict load, real CPU forward pass.
- Input `1x3x416x416`; finite output `1x3549x85` (80 COCO classes).
- First synthetic CPU forward: 55.63 ms. This is **not** a phone/browser benchmark.
- Integrity checks reject absent/modified checkpoints before deserialization.

## Reproduce

```bash
# CPU packages used for this measurement:
python -m pip install torch==2.15.0+cpu torchvision==0.29.2+cpu --index-url https://download.pytorch.org/whl/cpu
python -m pip install -r training/requirements-yolox-preflight.txt
git clone https://github.com/Megvii-BaseDetection/YOLOX.git /tmp/unidoors-yolox
git -C /tmp/unidoors-yolox checkout 6ddff4824372906469a7fae2dc3206c7aa4bbaee
curl -fL https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.pth -o /tmp/yolox_nano.pth
python training/yolox_preflight.py --upstream /tmp/unidoors-yolox --checkpoint /tmp/yolox_nano.pth --report /tmp/yolox-report.json
python -m unittest discover -s training -p 'test_*.py'
node training/test-door-quad.mjs
```

## Blocked / next

- The model is NOT door-trained. No weights were added to the web application or deployed.
- No GPU is available in this session. CPU PyTorch is installed and functioning.
- Roboflow dataset page is reachable; unauthenticated COCO export endpoint returned `This method requires your API key.` No credential was requested, stored, or committed. Public page availability does not mean a downloadable export is available without authentication.
- Obtain a permitted COCO ZIP export of the selected door/window dataset, inspect provenance and actual photographs/labels before training. Dataset use does not imply using Roboflow inference.
- Existing 21 corner labels remain unverified and must not be used to claim independent accuracy.
- Checkpoint commercial redistribution clearance remains pending. Download/inference here is an isolated research check, not permission to ship.
- Fine-tune YOLOX-Nano, then train the separate corner model when verified data is available; export/benchmark afterward.

## Continuity ruling

The actual remote branch is `experimental/local-ai-pipeline`; the earlier conversational name `feature/final-local-ai` does not exist remotely. The latest `LOCAL_AI_DELIVERY_CONTRACT.md` governs architecture over older RTMDet/EfficientDet proposals. The classic mode remains unchanged. The older Faster R-CNN training script is legacy research and is not the selected YOLOX training path.

## Follow-up correction — 2026-11-11

Subsequent visual inspection of the proposed Roboflow Door-Windows cover and four version thumbnails showed floorplans. That candidate is rejected for photographic Door Live training; obtaining its authenticated export is no longer a next step. See `docs/MODEL_SOURCE_LICENSE_AUDIT.md`.
