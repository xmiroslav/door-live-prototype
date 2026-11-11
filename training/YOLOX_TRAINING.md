# Executable YOLOX-Nano training path

This implements the approved detector architecture. It does **not** mean the door model has been trained, corner geometry works, or the product is ready.

## Inputs and gates

Use `train_yolox.py`; `train_pretrained_detector.py` is legacy Faster R-CNN research.

Inputs are separate local paths for:
- Images, in original normalized orientation.
- Existing `train_coco.json`, `val_coco.json`, `test_coco.json` and each `*_corners.json` verification/group sidecar.
- Pinned YOLOX source and exact COCO initialization checkpoint (see `YOLOX_PREFLIGHT.md`).
- Rights-review record based on `rights.example.json`, with actual evidence for training permission and exact checkpoint/dataset SHA256. Do not mark pending permission as approved to unblock a run.

The loader requires each image to be verified, dimensions to match, categories to agree across splits, and physical scene groups/exact bytes not to leak across splits. Multiple instances and images without any object annotations are retained. Perceptual scene review is still needed; distinct group strings do not establish genuinely different physical doors.

The dataset fingerprint binds image hashes and all six input annotation/review JSON hashes. To inspect a **verified** bundle and obtain its fingerprint:

```bash
PYTHONPATH=training python - <<'PY'
from yolox_dataset import load_bundle
bundle = load_bundle('/absolute/dataset/exports', '/absolute/dataset/images')
print(bundle['dataset_sha256'])
PY
```

The current 21-photo archive is unverified and correctly fails this check. It must not be relabeled as verified without visual annotation review. No provisional override is provided.

## Run after gates pass

Install the tested environment from `YOLOX_PREFLIGHT.md`. Keep private data and trained checkpoints outside this public repository.

```bash
python training/train_yolox.py \
  --dataset /absolute/dataset/exports \
  --images /absolute/dataset/images \
  --upstream /absolute/YOLOX \
  --checkpoint /absolute/yolox_nano.pth \
  --rights /absolute/reviewed-rights.json \
  --output /absolute/private-runs/experiment-001 \
  --epochs 20 --batch-size 2 --device cpu
```

CUDA is optional and must be selected explicitly. CPU training plumbing was tested; GPU execution is not verified in this environment. No paid training service is started by this script.

Preprocessing matches upstream Nano: 416 square, BGR float32 in 0..255, upper-left letterbox filled with 114. All compatible pretrained tensors transfer; only custom classification prediction tensors are reinitialized. There is no random-model fallback.

This initial path uses deterministic letterboxing without mosaic, mixup or random perspective. Data augmentation/optimization can follow after a measured baseline; the separate corner model must transform its labels consistently.

## Output and measurements

Each epoch saves checkpoint + optimizer, losses, class mapping, data hashes, seed, input/permission manifests and validation report. Experiment metadata records the training repository commit/dirty state, and an exact copy/checksum of the training sources is saved with the run. The final checkpoint has a SHA256 sidecar. Do not publish private input or rights manifests without review.

Validation uses class-aware one-to-one IoU >=0.5 matching after score filtering and class-aware NMS (defaults: 0.25 score / 0.45 NMS). Duplicate detections count as false positives. Reports include aggregate/per-class precision and recall plus false-positive incidence on images with no annotated objects. Undefined rates are `null`, not manufactured success percentages.

This is a fixed-threshold validation metric, **not COCO mAP**, a blind-test result or the project's >=90% door-frame recall acceptance. Class-aware numbers prevent window detections from counting as correct door detections. Detector boxes never become four-corner ground truth.

The final test split is audited for integrity but never passed through the model by this trainer. Previously used photos still cannot become a genuinely blind test merely because the script does not evaluate them.

## Verification performed — 2026-11-11

- Dataset/metric/preprocessing checks cover negatives, multiple instances, category mismatches, scene/hash leakage, dimensions, unsafe paths and pending permission.
- Actual pinned Nano model transferred pretrained weights and executed forward/backward/optimizer on synthetic input. A classification head changed and model parameters remained finite. This verifies the training plumbing, **not** useful learned door recognition.
- Current 21-photo bundle was rejected as unverified, before any training-output directory was created.
- No browser/production files were changed.

An upstream PyTorch AMP deprecation warning appears during the synthetic training step; it did not prevent the step. The pinned upstream source was left intact.

## Next gates

1. Confirm exact checkpoint permissions or choose a permitted compatible initialization without changing the rest of Door Live.
2. Visually correct and verify outer-frame-with-trim labels; document image rights; obtain permitted larger door/window data and a genuinely independent test set.
3. Train and measure the detector; then the corner model. Consider per-corner uncertainty/visibility for occluded corners before photo integration.
4. Export and verify ONNX numerically, then benchmark self-hosted WASM on physical iPhone/Android devices.
