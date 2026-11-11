# Door Live — local AI delivery contract (2026-11-11)

## Non-negotiable acceptance requirements

1. Inference runs **on the user's device**, inside Safari iOS and Chrome Android. No Roboflow / third-party detection API, and no photo upload for inference.
2. AI/model and all runtime binaries are hosted by Door Live; device downloads the files from our own origin. Offline after first use requires a separately tested service-worker cache.
3. Detect the **outer four corners of the fixed door frame, including casing / trim**; not the door leaf. Ground-truth order TL → TR → BR → BL in original image pixels. Handle skew, open/empty frames, windows as negatives, and multiple candidates.
4. Place the **actual selected Unidoors composite door**, including its frame/hardware/configuration, not a generic SVG.
5. Live camera: tracked placement and periodic re-detection; strong camera movement may require SLAM and is not guaranteed by template/optical tracking alone.
6. Manual quad adjustment remains available. No false automatic placement when confidence/geometry validation fails.
7. Existing classic mode is read-only. Experimental work only in branch `experimental/local-ai-pipeline`. Do not touch iOS app or unrelated repos.
8. Training outputs reproducible: dataset provenance, split, git commit, licensing manifest, weights checksum, model ONNX export, evaluation report, browser benchmarks.

## Components and legal gates

- Detector baseline **YOLOX-Nano**: upstream code Apache-2.0 (https://github.com/Megvii-BaseDetection/YOLOX). Standard COCO weights **do not classify doors/windows**; must be fine-tuned on licensed door/window data. Do not deploy pretrained weights until checkpoint-specific permission and redistribution terms are documented.
- Keypoints: dedicated small model for frame corners; no implied pretrained accuracy. Needs *verified* corner labels.
- Inference: ONNX Runtime Web, WASM baseline for iOS + Android; WebGPU optional, never required. https://onnxruntime.ai/docs/get-started/with-javascript/web.html
- Geometry: perspective projection and quad sanity checks; separate from detection accuracy.
- Tracking: optical/feature tracker with re-detection; true world-anchored mobile AR cannot be promised from 2D tracking alone.
- Data licensing: every photo/annotation requires documented rights. Dataset license != training-code license != model-weights license != rights to redistribute final model.
- Third-party binaries need NOTICE/license inventory and security version pinning. No secrets/API keys in static browser sources.

## Current baseline (not claims of readiness)

- Dataset ZIP: 21 images: 13 train, 5 validation, 3 test; **all 21 provisional quad labels unverified**. Audit split leakage and image provenance before using as evaluation.
- Previous scratch-trained tiny CNN had weak holdout results; it is NOT pretrained detector and NOT integrated in production.
- Current experimental web camera is heuristic-based. The older cloud comparison test is not product infrastructure.
- Browser annotation editor: `experimental-annotation-review.html` (local files only, JSON import/edit/approve/export). It helps turn provisional labels into verified ones; it is NOT AI.
- No accepted/deployed local door/window detector as of 2026-11-11. A Google Door/Window-pretrained research candidate now exists as an evaluated alternative with owner-declared Apache-2.0 weights, fixed ONNX export and offline WASM checks; it has not replaced the approved YOLOX baseline or satisfied frame-corner/mobile acceptance. See `GOOGLE_OPENIMAGES_CHECKPOINT_EVALUATION.md`.

## Stage gates (no skipping)

**G0 — Legal provenance.** Confirm source code, exact pretrained checkpoint license, training images, output model redistribution rights. If unclear, do NOT ship.

**G1 — Dataset ground truth.** Verify all 21 existing labels (not just format) and add class/negative examples. Separate train/val/test by physical doorway/location, not merely by filename. Mark unseen final test images and never tune on them.

**G2 — Detector.** Fine-tune permitted pretrained YOLOX on door/frame/window classes using more licensed labeled data. Produce actual weights and test precision/recall; no passing on training images.

**G3 — Corners.** Train/validate TL/TR/BR/BL on visible outer trim or frame; estimate corner error relative to image diagonal and validity; reject uncertain detections.

**G4 — Browser packaging.** Export fixed preprocessing/postprocessing + ONNX weights, pin and self-host ONNX Runtime Web and WASM. Verify a real prediction with devtools network disconnected after assets load.

**G5 — Photo placement.** Integrate chosen Unidoors door layers and homography; acceptance on straight/oblique/empty/open frames; retain manual fallback.

**G6 — Live camera.** Track geometry over time, re-detect, log confidence and latency; measure drift, jitter, failure recovery and real iPhone/Android performance.

**G7 — Ship readiness.** Verify licensing, privacy, device matrix, rollback/model versioning, security and performance, documented training/update process.

### Proposed initial acceptance thresholds (targets, not achieved)
- >=90% recall on agreed independent test scenes.
- median corner error <=2% of image diagonal, explicitly measured against outer trim.
- device-specific acceptable latency, drift and false-positive thresholds to be established from measured real phones.
- No claim of stable world anchor until measured under motion and occlusions.

## Status format
Each update: **Done / Tested / Blocked / Next**, links to commits and actual measurements. Never label preparation or syntax checks as trained AI.
