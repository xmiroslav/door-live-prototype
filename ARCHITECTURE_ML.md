# Door Live — architecture handoff (2026-11-08)

## Frozen baseline
Branch: `backup/pre-ml-detector-2026-11-08` (created from `main` before ML changes). To restore: deploy this branch or reset main to its commit after review; do not overwrite main automatically.
Working viewer: browser-only, Hebrew RTL, photo upload and live camera, WebGL projective door overlay with canvas fallback, four-corner manual correction, optical-flow/OpenCV tracking, screenshot/share, door image sent from Unidoors `#bigdoor` by html-to-image through iframe postMessage.
Known defects: bright doors on bright walls, open doorframes, coat racks mistaken for lintels, unstable live detection/tracking, inconsistent quad geometry, configured-door artwork may miss details, iOS Photos save requires native share sheet/user action. No guarantee of 3–4s detection.

## New architecture (isolated feature branch)
1. `door-ml-detector.js`: model adapter for a *trained four-corner doorway keypoint model* (ONNX, browser inference via onnxruntime-web). Model contract: input RGB 320x320; output `corners` [1,8] normalized TL TR BR BL and `confidence` [1,1]. **No trained model weights are bundled yet.** Until weights are supplied, adapter explicitly returns unavailable; it must not pretend to detect doors.
2. `door-detection-pipeline.js`: ML-first, deterministic validation, geometry fallback. Prevents false-positive output from a missing model; checks convexity, size, shape, orientation, edge agreement. Produces provenance `ml` or `geometry`.
3. Existing `door-detector-worker.js` retained as geometric fallback, not silently removed.
4. Existing tracker remains separate. After stable keypoint detection, tracker receives the four corners and verifies motion against jamb evidence; freeze on low confidence and offer manual correction.

## Model data / training contract
Label each image with four points in **image pixel coordinates** in order TL, TR, BR, BL, at the *outer edge of the replacement frame*; include `door_closed`, `door_open`, `empty_opening`, `white_on_white`, `occluded`, and hard negatives (coat racks, windows, shelves, wall seams). Split by physical doorway/site, not random near-duplicate frames. Include video sequences with consistent corner IDs and tracking evaluation.
Recommended: pretrained lightweight backbone + fine-tuned 4-corner head, export to ONNX, static quantization if quality allows, host model with versioned immutable URL. Train outside the browser; run inference locally in Safari/Chrome WASM, with optional WebGPU only when supported.
Metrics: corner reprojection error normalized by door diagonal; false positives on hard negatives; detection time p50/p95 on actual iPhone; tracking drift and reacquisition under motion. Target p95 <=4s is a *goal*, not validated.
No ML inference can run until a compatible trained ONNX model exists. Avoid generic COCO detectors: COCO has no reliable doorway keypoint class.

## Deployment
Main stays intact. Test ML branch separately (e.g. GitHub Pages preview via separate hosting); do not switch production configurator script until measured against the supplied three door photos and live iPhone.
