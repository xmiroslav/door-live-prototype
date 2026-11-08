# Door Live — Doorway AI model integration plan

Status: PREPARATION ONLY. No door-trained weights are installed or deployed.

## Target
Mobile Safari and Android Chrome; local browser inference via ONNX Runtime Web (WASM fallback).
Detection target: outer doorway/frame corners, ordered top-left, top-right, bottom-right, bottom-left, in image pixel coordinates.
Distinguish open doorway vs closed door; reject windows, wardrobes and coat racks. Handle multiple candidates and low-contrast white frames.
Detection and temporal tracking are distinct tasks. Preserve manual four-corner adjustment as fallback.

## Proposed architecture
1. RTMDet-tiny candidate detector, fine-tuned for doorway bounding boxes.
2. RTMPose-s keypoint head, fine-tuned to output four doorway corners. The public human-pose checkpoint is NOT a door detector.
3. Perspective projection via existing door-projector.js; optical flow + periodic model re-detection.
4. Measure cold-start, first detection (<4s target, not guaranteed), tracking drift and false positives on real iPhones and Android devices.
5. Enable only behind a feature flag after validation; do not replace the working heuristic prematurely.

## Training labels
Each image: one or more instances with bbox, four corners TL/TR/BR/BL, class (closed_door, open_doorway, open_door), visibility flags; images without doors are negative examples.
Split by physical doorway/location rather than adjacent video frames to avoid leakage.
Aim for 200–300 varied images for an initial experiment, then expand from failure cases. 15 supplied examples are a starter set, not sufficient proof of robustness.
Only use photos with adequate rights; avoid unlicensed watermarked catalog imagery.

## Licensing gate
- OpenMMLab MMPose and MMDetection source repositories: Apache-2.0.
- Specific pretrained weight/checkpoint redistribution and commercial use: VERIFY SEPARATELY before shipping. Do not assume source license covers checkpoints.
- ONNX Runtime Web and all transitive dependencies: audit version and notices before distribution.
- Preserve copyright, LICENSE, NOTICE and modification notices as applicable.
- Do not ship unverified model files or claim a trained detector exists.

## Integration acceptance
- Four corners agree with outer frame (not leaf) on a held-out test set.
- White-on-white, open doorway, perspective, multi-door and negative examples covered.
- Stable anchoring under moderate phone motion; no projection drift or inversion.
- Camera and photo modes, manual correction, and export continue working.
- Same deployed URL; back up current version before switching detector.

References:
https://github.com/open-mmlab/mmpose
https://github.com/open-mmlab/mmdetection
https://onnxruntime.ai/docs/get-started/with-javascript/web.html
https://github.com/open-mmlab/mmpose/issues/3273
