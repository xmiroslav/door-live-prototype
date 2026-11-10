# RF-DETR feasibility audit — 2026-11-10

## Verified from official vendor documentation
- RF-DETR **Nano/Small/Medium/Large detection**: Apache-2.0, commercial self-hosting allowed with notices; **Atto/Femto/Pico/XL/2XL detection**: PML 1.0, not selected.
- RF-DETR Keypoint Preview: Apache-2.0 but pretrained on **17 human body keypoints**, not door corners. Custom training required.
- Nano: **30.5M parameters**, 384x384, 2.3 ms on NVIDIA T4 TensorRT FP16 **only**. This does not measure Safari/Android performance.
- ONNX supported. TFLite export documented as **experimental** with possible dependency and output layout breakages. MediaPipe ObjectDetector drop-in compatibility is not established.
- No per-inference license cost for local Apache-2.0 use; cloud/GPU/hosting costs are separate.

Official sources:
https://github.com/roboflow/rf-detr
https://roboflow.com/model-licenses/rf-detr
https://rfdetr.roboflow.com/latest/learn/run/detection/
https://rfdetr.roboflow.com/latest/learn/run/keypoints/
https://github.com/roboflow/rf-detr/blob/develop/docs/exports/tflite.md

## Actual local checks (not claimed as RF-DETR inference)
Inspected `/mnt/data/door_ai_batch_02_03/corrected_annotations.json` and original files.
- 14 annotated images available, 8 physical doorway groups.
- **0/14 labels marked verified**.
- All 14 quads have points inside the source image and pass basic convexity checks.
- All 14 corresponding originals exist locally.
- Runtime: PyTorch 2.10.0 CPU, no CUDA GPU, no `rfdetr`, `onnxruntime`, or `onnx` installed.
- No physical iPhone/Android browser connected. No mobile performance measurements.

## Gate status
| Gate | Result |
|---|---|
| Code/weights commercial licensing | PASS for selected Apache-2.0 variants, subject to bundled third-party and data licenses |
| Mandatory Roboflow subscription | NOT REQUIRED for self-hosted Apache-2.0 |
| Training data presence | PARTIAL: 14 local provisional annotations, all 14 originals |
| Verified door-frame labels | FAIL: 0 verified |
| RF-DETR weights loaded and run | NOT TESTED |
| Fine-tuned on doorway class | NOT DONE |
| Door / window / niche false-positive evaluation | NOT DONE |
| Perspective four-corner prediction | NOT PROVIDED by pretrained detector |
| ONNX/TFLite export verified locally | NOT TESTED |
| MediaPipe direct compatibility | UNCONFIRMED |
| iPhone Safari / Android Chrome latency | NOT TESTED |
| No-server browser operation | UNCONFIRMED |
| Live Door Live deployment | NOT DONE |

**Decision:** Conditional candidate for an offline proof-of-concept, **not approved for production**. Next: verify ground-truth labels and rights to training images, install RF-DETR in a GPU environment, fine-tune Nano, evaluate held-out physical door groups + negatives, export ONNX, run browser benchmarks on real phones. Preserve existing heuristic mode.
