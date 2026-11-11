# Door Live — archived architecture exploration

**Historical proposals only.** RTMDet / RTMPose and MediaPipe sections below are superseded by `LOCAL_AI_DELIVERY_CONTRACT.md`. The current selected detector baseline is YOLOX-Nano, with a separate corner model and ONNX Runtime Web. Do not implement older candidates from this history.

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

## Feasibility audit — 2026-11-08
Decision: **CONDITIONAL / NOT APPROVED FOR PRODUCTION YET**.
- Browser feasibility: ONNX Runtime Web documents WASM support for iOS Safari and Android Chrome; WebGPU is not supported for iOS Safari in the current support matrix. Benchmark WASM on target iPhones.
- Cost: self-hosted browser inference has no per-inference API fee, but incurs CDN/hosting bandwidth, one-time training compute, engineering and maintenance costs.
- Licensing: OpenMMLab source Apache-2.0 verified; exact RTMPose/RTMDet pretrained checkpoint and training-data provenance NOT cleared. Open MMPose issues #3277 and #3282 request clarification. Do not download, train from, or ship ambiguous checkpoints for commercial release until cleared; prefer verified commercially permitted initializations or train from scratch if practical.
- Accuracy: RTMPose-s is human keypoint estimation, NOT pretrained door corners. Four-corner accuracy, open/closed detection, white-on-white, negatives, multiple doors and tracking remain unproven.
- Performance: RTMDet published latency is on NVIDIA GPU, not Safari. A real-device ONNX WASM benchmark is mandatory before committing to this architecture.
- Perspective projection needs 4 corners; metric depth/true 3D anchoring cannot be guaranteed from a single RGB camera frame by RTMPose alone.
- Gate: prove asset license; train proof of concept on licensed annotated images; benchmark held-out corner error, false positives, first detection under 4s, drift, cold load, memory and heat on iPhone and Android; then approve feature-flagged integration. Retain current manual fallback and previous revision.
Sources:
https://github.com/open-mmlab/mmpose/issues/3277
https://github.com/open-mmlab/mmpose/issues/3282
https://onnxruntime.ai/docs/get-started/with-javascript/web.html
https://github.com/Tau-J/rtmlib/blob/main/README.md

## Alternative chosen for feasibility prototyping: MediaPipe custom detector
Status: **APPROVED FOR INTEGRATION SCAFFOLD, NOT APPROVED FOR PRODUCTION DETECTION**.
- Google MediaPipe Tasks Vision: Apache-2.0 source, WebAssembly browser execution on modern Safari/Chrome, local on-device inference.
- MediaPipe Model Maker supports custom object detection; select and verify the exact compatible base TFLite checkpoint and its license before training or redistribution.
- Detection output is an axis-aligned bounding box, NOT four doorway corners. Existing geometric line refinement/manual 4-corner UI must remain, with independent evaluation.
- Do not assume a generic COCO detector knows doors.
- Preserve current detector as default; new detector must be behind a disabled-by-default feature flag until a trained compatible .tflite model is supplied and validated.
- No per-frame API cost; hosting bandwidth, training compute, and maintenance still have costs.
- Performance and corner accuracy are not guaranteed. Benchmark Safari on physical iPhone and Android Chrome before enabling.
References:
https://github.com/google-ai-edge/mediapipe
https://codelabs.developers.google.com/mp-object-detection-web
https://developers.google.com/mediapipe
